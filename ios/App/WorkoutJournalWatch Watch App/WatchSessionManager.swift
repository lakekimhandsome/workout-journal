import Foundation
import Combine
import WatchConnectivity
import WatchKit

@MainActor
final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published private(set) var endTimeMs: Double = 0
    @Published private(set) var isRunning: Bool = false
    @Published private(set) var totalSeconds: Int = 0

    private var pendingSetButtonPress = false
    private var lastStartHapticEndTimeMs: Double = 0

    private override init() {
        super.init()
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

    func sendSetButtonPressed() {
        sendEvent("setButtonPressed", pendingFlag: true)
    }

    func sendTimerReset() {
        isRunning = false
        endTimeMs = 0
        lastStartHapticEndTimeMs = 0
        sendEvent("timerReset", pendingFlag: false)
    }

    private func sendEvent(_ event: String, pendingFlag: Bool) {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        let payload = ["event": event]

        if session.activationState != .activated {
            if pendingFlag {
                pendingSetButtonPress = true
            }
            session.activate()
            return
        }

        deliverEvent(using: session, payload: payload)
    }

    private func deliverEvent(using session: WCSession, payload: [String: String]) {
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                NSLog("Watch sendMessage failed: \(error.localizedDescription)")
            }
            return
        }

        session.transferUserInfo(payload)
    }

    private func applyContext(_ context: [String: Any]) {
        let running = context["running"] as? Bool ?? false
        let endTime = context["endTime"] as? Double ?? 0
        let totalValue = context["totalSeconds"]
        let total: Int

        if let intTotal = totalValue as? Int {
            total = intTotal
        } else if let doubleTotal = totalValue as? Double {
            total = Int(doubleTotal)
        } else {
            total = 0
        }

        isRunning = running
        endTimeMs = running ? endTime : 0
        totalSeconds = total

        if running, endTime > 0, endTime != lastStartHapticEndTimeMs {
            WKInterfaceDevice.current().play(.start)
            lastStartHapticEndTimeMs = endTime
        }

        if !running {
            lastStartHapticEndTimeMs = 0
        }
    }

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let context = session.receivedApplicationContext

        Task { @MainActor in
            if !context.isEmpty {
                self.applyContext(context)
            }

            if self.pendingSetButtonPress, activationState == .activated {
                self.pendingSetButtonPress = false
                self.deliverEvent(using: session, payload: ["event": "setButtonPressed"])
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            self.applyContext(applicationContext)
        }
    }
}
