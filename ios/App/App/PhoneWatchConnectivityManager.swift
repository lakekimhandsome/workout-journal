import Capacitor
import Foundation
import WatchConnectivity

final class PhoneWatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchConnectivityManager()

    private static let processedIdsKey = "phone.watch.processedEventIds"
    private static let pendingJSEventsKey = "phone.watch.pendingJSEvents"
    private static let maxProcessedIds = 200

    private weak var plugin: WatchConnectivityPlugin?
    private weak var bridge: CAPBridgeProtocol?

    private var processedEventIds: [String] = []
    private var pendingJSEvents: [[String: Any]] = []

    private override init() {
        super.init()
        processedEventIds = loadProcessedIds()
        pendingJSEvents = loadPendingJSEvents()
    }

    func bind(plugin: WatchConnectivityPlugin, bridge: CAPBridgeProtocol?) {
        self.plugin = plugin
        self.bridge = bridge
        flushPendingJSEvents()
    }

    func activate() {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func pushTimerState(running: Bool, endTimeMs: Double, totalSeconds: Int, stoppedEndTimeMs: Double = 0) {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        guard session.activationState == .activated else {
            return
        }

        var context: [String: Any] = [
            "running": running,
            "endTime": endTimeMs,
            "totalSeconds": totalSeconds,
        ]

        if !running, stoppedEndTimeMs > 0 {
            context["stoppedEndTime"] = stoppedEndTimeMs
        }

        do {
            try session.updateApplicationContext(context)
        } catch {
            NSLog("WatchConnectivity updateApplicationContext failed: \(error.localizedDescription)")
        }
    }

    private func notifySetButtonPressed(_ data: [String: Any]) {
        if let plugin {
            plugin.notifyListeners("setButtonPressed", data: data, retainUntilConsumed: true)
            return
        }

        bridge?.triggerWindowJSEvent(eventName: "setButtonPressed", data: Self.jsonString(from: data))
    }

    private func notifyTimerReset(_ data: [String: Any]) {
        if let plugin {
            plugin.notifyListeners("timerReset", data: data, retainUntilConsumed: true)
            return
        }

        bridge?.triggerWindowJSEvent(eventName: "timerReset", data: Self.jsonString(from: data))
    }

    private static func jsonString(from data: [String: Any]) -> String {
        guard
            JSONSerialization.isValidJSONObject(data),
            let encoded = try? JSONSerialization.data(withJSONObject: data),
            let string = String(data: encoded, encoding: .utf8)
        else {
            return "{}"
        }

        return string
    }

    private func handleWatchEvent(_ payload: [String: Any]) {
        guard let event = payload["event"] as? String else {
            return
        }

        let eventId = (payload["id"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedId = (eventId?.isEmpty == false) ? eventId! : UUID().uuidString

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                return
            }

            if self.processedEventIds.contains(resolvedId) {
                return
            }

            self.rememberProcessedId(resolvedId)

            var data: [String: Any] = [
                "id": resolvedId,
            ]

            if let timestamp = Self.doubleValue(payload["timestamp"]) {
                data["timestamp"] = timestamp
            }

            if let endTime = Self.doubleValue(payload["endTime"]) {
                data["endTime"] = endTime
            }

            if let totalSeconds = Self.intValue(payload["totalSeconds"]) {
                data["totalSeconds"] = totalSeconds
            }

            switch event {
            case "setButtonPressed":
                self.dispatchToJS(event: "setButtonPressed", data: data)
            case "timerReset":
                self.dispatchToJS(event: "timerReset", data: data)
            default:
                break
            }
        }
    }

    private func dispatchToJS(event: String, data: [String: Any]) {
        // If the Capacitor bridge/plugin is not ready yet (background wake),
        // persist and flush when JS binds.
        guard plugin != nil || bridge != nil else {
            var queued = data
            queued["event"] = event
            pendingJSEvents.append(queued)
            savePendingJSEvents()
            return
        }

        switch event {
        case "setButtonPressed":
            notifySetButtonPressed(data)
        case "timerReset":
            notifyTimerReset(data)
        default:
            break
        }
    }

    private func flushPendingJSEvents() {
        guard !pendingJSEvents.isEmpty else {
            return
        }

        let batch = pendingJSEvents
        pendingJSEvents.removeAll()
        savePendingJSEvents()

        for item in batch {
            let event = item["event"] as? String ?? ""
            var data = item
            data.removeValue(forKey: "event")

            switch event {
            case "setButtonPressed":
                notifySetButtonPressed(data)
            case "timerReset":
                notifyTimerReset(data)
            default:
                break
            }
        }
    }

    private func rememberProcessedId(_ id: String) {
        processedEventIds.append(id)

        if processedEventIds.count > Self.maxProcessedIds {
            processedEventIds.removeFirst(processedEventIds.count - Self.maxProcessedIds)
        }

        saveProcessedIds()
    }

    private func saveProcessedIds() {
        UserDefaults.standard.set(processedEventIds, forKey: Self.processedIdsKey)
    }

    private func loadProcessedIds() -> [String] {
        UserDefaults.standard.stringArray(forKey: Self.processedIdsKey) ?? []
    }

    private func savePendingJSEvents() {
        UserDefaults.standard.set(pendingJSEvents, forKey: Self.pendingJSEventsKey)
    }

    private func loadPendingJSEvents() -> [[String: Any]] {
        UserDefaults.standard.array(forKey: Self.pendingJSEventsKey) as? [[String: Any]] ?? []
    }

    private static func doubleValue(_ value: Any?) -> Double? {
        if let number = value as? Double {
            return number
        }

        if let number = value as? Int {
            return Double(number)
        }

        if let number = value as? NSNumber {
            return number.doubleValue
        }

        return nil
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let number = value as? Int {
            return number
        }

        if let number = value as? Double {
            return Int(number)
        }

        if let number = value as? NSNumber {
            return number.intValue
        }

        return nil
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleWatchEvent(message)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        handleWatchEvent(message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handleWatchEvent(userInfo)
    }
}
