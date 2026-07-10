import WatchKit
import WatchConnectivity

/// Completes watchOS WatchConnectivity background tasks so the system does not
/// SIGKILL the app after the background time budget is exhausted.
final class WatchApplicationDelegate: NSObject, WKApplicationDelegate {
    private var outstandingConnectivityTasks: [WKWatchConnectivityRefreshBackgroundTask] = []

    func applicationDidFinishLaunching() {
        Task { @MainActor in
            WatchSessionManager.shared.activate()
            WatchSessionManager.shared.onConnectivityWorkFinished = { [weak self] in
                self?.completeOutstandingConnectivityTasks()
            }
        }
    }

    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if let connectivityTask = task as? WKWatchConnectivityRefreshBackgroundTask {
                outstandingConnectivityTasks.append(connectivityTask)
                Task { @MainActor in
                    WatchSessionManager.shared.activate()
                    WatchSessionManager.shared.flushPendingEventsIfNeeded()
                }
                continue
            }

            task.setTaskCompletedWithSnapshot(false)
        }

        // Finish immediately when there is nothing left for WCSession to deliver.
        if WCSession.isSupported() {
            let session = WCSession.default
            if session.activationState == .activated, !session.hasContentPending {
                completeOutstandingConnectivityTasks()
            }
        } else {
            completeOutstandingConnectivityTasks()
        }

        // Safety net: never leave tasks hanging if flush is a no-op.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.completeOutstandingConnectivityTasks()
        }
    }

    private func completeOutstandingConnectivityTasks() {
        guard !outstandingConnectivityTasks.isEmpty else {
            return
        }

        let tasks = outstandingConnectivityTasks
        outstandingConnectivityTasks.removeAll()
        tasks.forEach { $0.setTaskCompletedWithSnapshot(false) }
    }
}
