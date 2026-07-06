import Capacitor
import Foundation
import WatchConnectivity

final class PhoneWatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchConnectivityManager()

    private weak var plugin: WatchConnectivityPlugin?
    private weak var bridge: CAPBridgeProtocol?

    private override init() {
        super.init()
    }

    func bind(plugin: WatchConnectivityPlugin, bridge: CAPBridgeProtocol?) {
        self.plugin = plugin
        self.bridge = bridge
    }

    func activate() {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func pushTimerState(running: Bool, endTimeMs: Double, totalSeconds: Int) {
        guard WCSession.isSupported() else {
            return
        }

        let session = WCSession.default
        guard session.activationState == .activated else {
            return
        }

        let context: [String: Any] = [
            "running": running,
            "endTime": endTimeMs,
            "totalSeconds": totalSeconds,
        ]

        do {
            try session.updateApplicationContext(context)
        } catch {
            NSLog("WatchConnectivity updateApplicationContext failed: \(error.localizedDescription)")
        }
    }

    private func notifySetButtonPressed() {
        if let plugin {
            plugin.notifyListeners("setButtonPressed", data: [:])
            return
        }

        bridge?.triggerWindowJSEvent(eventName: "setButtonPressed")
    }

    private func notifyTimerReset() {
        if let plugin {
            plugin.notifyListeners("timerReset", data: [:])
            return
        }

        bridge?.triggerWindowJSEvent(eventName: "timerReset")
    }

    private func handleWatchEvent(_ payload: [String: Any]) {
        guard let event = payload["event"] as? String else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            switch event {
            case "setButtonPressed":
                self?.notifySetButtonPressed()
            case "timerReset":
                self?.notifyTimerReset()
            default:
                break
            }
        }
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
