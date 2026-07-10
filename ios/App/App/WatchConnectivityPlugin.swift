import Capacitor
import Foundation

@objc(WatchConnectivityPlugin)
public class WatchConnectivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchConnectivityPlugin"
    public let jsName = "WatchConnectivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pushTimerState", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        PhoneWatchConnectivityManager.shared.bind(plugin: self, bridge: bridge)
        PhoneWatchConnectivityManager.shared.activate()
    }

    @objc func pushTimerState(_ call: CAPPluginCall) {
        let running = call.getBool("running") ?? false
        let endTime = call.getDouble("endTime") ?? 0
        let totalSeconds = call.getInt("totalSeconds") ?? 0
        let stoppedEndTime = call.getDouble("stoppedEndTime") ?? 0

        PhoneWatchConnectivityManager.shared.pushTimerState(
            running: running,
            endTimeMs: endTime,
            totalSeconds: totalSeconds,
            stoppedEndTimeMs: stoppedEndTime
        )
        call.resolve()
    }
}
