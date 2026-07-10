import Foundation
import Combine
import WatchConnectivity
import WatchKit

/// Watch-local event queued for eventual sync to iPhone (Source of Truth).
private struct PendingWatchEvent: Codable, Equatable {
    let id: String
    let event: String
    let timestamp: Double
    let endTime: Double?
    let totalSeconds: Int?
}

@MainActor
final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    private static let defaultTotalSeconds = 90
    private static let pendingEventsKey = "watch.pendingEvents"
    private static let cachedTotalSecondsKey = "watch.cachedTotalSeconds"
    private static let localTimerKey = "watch.localTimer"

    @Published private(set) var endTimeMs: Double = 0
    @Published private(set) var isRunning: Bool = false
    @Published private(set) var totalSeconds: Int = 0

    private var cachedTotalSeconds: Int = WatchSessionManager.defaultTotalSeconds
    private var pendingEvents: [PendingWatchEvent] = []
    private var lastStartHapticEndTimeMs: Double = 0
    private var isFlushing = false

    /// Invoked after queued Watch→Phone transfers are handed to the system.
    var onConnectivityWorkFinished: (() -> Void)?

    private override init() {
        super.init()
        cachedTotalSeconds = loadCachedTotalSeconds()
        totalSeconds = cachedTotalSeconds
        pendingEvents = loadPendingEvents()
        restoreLocalTimerIfNeeded()
    }

    func activate() {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func remainingSeconds(at date: Date = Date()) -> Int {
        guard isRunning, endTimeMs > 0, totalSeconds > 0 else {
            return 0
        }

        let nowMs = date.timeIntervalSince1970 * 1000
        let startMs = endTimeMs - Double(totalSeconds) * 1000
        let elapsedMs = max(0, nowMs - startMs)
        return max(0, totalSeconds - Int(elapsedMs / 1000))
    }

    func remainingProgress(at date: Date = Date()) -> Double {
        guard isRunning, endTimeMs > 0, totalSeconds > 0 else {
            return 0
        }

        let remainingMs = max(0, endTimeMs - date.timeIntervalSince1970 * 1000)
        return min(1, remainingMs / (Double(totalSeconds) * 1000))
    }

    func showsTimer(at date: Date = Date()) -> Bool {
        isRunning && endTimeMs > 0
    }

    /// Immediately starts haptic + local timer, then queues a set event for iPhone sync.
    func sendSetButtonPressed() {
        let duration = max(cachedTotalSeconds, 1)
        let nowMs = Date().timeIntervalSince1970 * 1000
        let endTime = nowMs + Double(duration) * 1000

        isRunning = true
        endTimeMs = endTime
        totalSeconds = duration
        lastStartHapticEndTimeMs = endTime
        WKInterfaceDevice.current().play(.start)
        persistLocalTimer()

        enqueue(
            PendingWatchEvent(
                id: UUID().uuidString,
                event: "setButtonPressed",
                timestamp: nowMs,
                endTime: endTime,
                totalSeconds: duration
            )
        )
        flushPendingEvents()
    }

    /// Immediately stops the local timer, then queues a reset for iPhone sync.
    func sendTimerReset() {
        isRunning = false
        endTimeMs = 0
        lastStartHapticEndTimeMs = 0
        clearLocalTimer()

        enqueue(
            PendingWatchEvent(
                id: UUID().uuidString,
                event: "timerReset",
                timestamp: Date().timeIntervalSince1970 * 1000,
                endTime: nil,
                totalSeconds: cachedTotalSeconds
            )
        )
        flushPendingEvents()
    }

    func flushPendingEventsIfNeeded() {
        flushPendingEvents()
    }

    // MARK: - Local timer persistence

    private func persistLocalTimer() {
        guard isRunning, endTimeMs > 0 else {
            clearLocalTimer()
            return
        }

        let payload: [String: Any] = [
            "endTime": endTimeMs,
            "totalSeconds": totalSeconds,
        ]
        UserDefaults.standard.set(payload, forKey: Self.localTimerKey)
    }

    private func clearLocalTimer() {
        UserDefaults.standard.removeObject(forKey: Self.localTimerKey)
    }

    private func restoreLocalTimerIfNeeded() {
        guard
            let payload = UserDefaults.standard.dictionary(forKey: Self.localTimerKey),
            let endTime = payload["endTime"] as? Double,
            endTime > Date().timeIntervalSince1970 * 1000
        else {
            clearLocalTimer()
            return
        }

        let totalValue = payload["totalSeconds"]
        let total: Int
        if let intTotal = totalValue as? Int {
            total = intTotal
        } else if let doubleTotal = totalValue as? Double {
            total = Int(doubleTotal)
        } else {
            total = cachedTotalSeconds
        }

        isRunning = true
        endTimeMs = endTime
        totalSeconds = max(total, 1)
        lastStartHapticEndTimeMs = endTime
    }

    // MARK: - Pending event queue

    private func enqueue(_ event: PendingWatchEvent) {
        pendingEvents.append(event)
        savePendingEvents()
    }

    private func flushPendingEvents() {
        guard WCSession.isSupported(), !isFlushing else {
            onConnectivityWorkFinished?()
            return
        }

        let session = WCSession.default
        guard session.activationState == .activated else {
            session.activate()
            return
        }

        guard !pendingEvents.isEmpty else {
            onConnectivityWorkFinished?()
            return
        }

        isFlushing = true
        defer { isFlushing = false }

        let batch = pendingEvents
        for event in batch {
            deliver(event, using: session)
        }

        // Handed off to WatchConnectivity (system-queued when using transferUserInfo).
        pendingEvents.removeAll()
        savePendingEvents()
        onConnectivityWorkFinished?()
    }

    private func deliver(_ event: PendingWatchEvent, using session: WCSession) {
        var payload: [String: Any] = [
            "event": event.event,
            "id": event.id,
            "timestamp": event.timestamp,
        ]

        if let endTime = event.endTime {
            payload["endTime"] = endTime
        }

        if let totalSeconds = event.totalSeconds {
            payload["totalSeconds"] = totalSeconds
        }

        // Use exactly one delivery path to avoid duplicate wakeups / budget pressure.
        // sendMessage when reachable (low latency); otherwise transferUserInfo (queued).
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { [weak self] error in
                NSLog("Watch sendMessage failed: \(error.localizedDescription)")
                // Fall back to reliable queued delivery if the live message fails.
                WCSession.default.transferUserInfo(payload)
                Task { @MainActor in
                    self?.onConnectivityWorkFinished?()
                }
            }
        } else {
            session.transferUserInfo(payload)
        }
    }

    private func savePendingEvents() {
        guard let data = try? JSONEncoder().encode(pendingEvents) else {
            return
        }

        UserDefaults.standard.set(data, forKey: Self.pendingEventsKey)
    }

    private func loadPendingEvents() -> [PendingWatchEvent] {
        guard
            let data = UserDefaults.standard.data(forKey: Self.pendingEventsKey),
            let events = try? JSONDecoder().decode([PendingWatchEvent].self, from: data)
        else {
            return []
        }

        return events
    }

    private func loadCachedTotalSeconds() -> Int {
        let saved = UserDefaults.standard.integer(forKey: Self.cachedTotalSecondsKey)
        return saved > 0 ? saved : Self.defaultTotalSeconds
    }

    private func updateCachedTotalSeconds(_ value: Int) {
        guard value > 0 else {
            return
        }

        cachedTotalSeconds = value
        UserDefaults.standard.set(value, forKey: Self.cachedTotalSecondsKey)

        if !isRunning {
            totalSeconds = value
        }
    }

    // MARK: - Application context (Phone → Watch)

    private func applyContext(_ context: [String: Any], allowStopLocalTimer: Bool) {
        let totalValue = context["totalSeconds"]
        let incomingTotal: Int
        if let intTotal = totalValue as? Int {
            incomingTotal = intTotal
        } else if let doubleTotal = totalValue as? Double {
            incomingTotal = Int(doubleTotal)
        } else {
            incomingTotal = 0
        }

        if incomingTotal > 0 {
            updateCachedTotalSeconds(incomingTotal)
        }

        let running = context["running"] as? Bool ?? false
        let endTime = context["endTime"] as? Double ?? 0
        let stoppedEndTime = context["stoppedEndTime"] as? Double ?? 0
        let nowMs = Date().timeIntervalSince1970 * 1000

        if running, endTime > nowMs {
            // Phone started or confirmed a timer — adopt as display state.
            isRunning = true
            endTimeMs = endTime
            totalSeconds = incomingTotal > 0 ? incomingTotal : cachedTotalSeconds
            persistLocalTimer()

            if endTime != lastStartHapticEndTimeMs {
                WKInterfaceDevice.current().play(.start)
                lastStartHapticEndTimeMs = endTime
            }
            return
        }

        if !running {
            if isRunning {
                let matchesActiveTimer =
                    stoppedEndTime > 0 && abs(stoppedEndTime - endTimeMs) < 1000
                let timerAlreadyExpired = endTimeMs <= nowMs

                // Ignore unrelated stale "stopped" context (e.g. iPhone cold launch)
                // so an independent Watch timer keeps running offline.
                if !allowStopLocalTimer || (!matchesActiveTimer && !timerAlreadyExpired) {
                    return
                }
            }

            isRunning = false
            endTimeMs = 0
            lastStartHapticEndTimeMs = 0
            clearLocalTimer()
        }
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let context = session.receivedApplicationContext

        Task { @MainActor in
            if !context.isEmpty {
                // On activation, never kill an already-running local timer with
                // a possibly stale phone context.
                self.applyContext(context, allowStopLocalTimer: !self.isRunning)
            }

            if activationState == .activated {
                self.flushPendingEvents()
            } else {
                self.onConnectivityWorkFinished?()
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            // Live updates from phone may stop the timer (phone UI reset / sync).
            self.applyContext(applicationContext, allowStopLocalTimer: true)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            if session.isReachable {
                self.flushPendingEvents()
            }
        }
    }
}
