import SwiftUI

@main
struct WorkoutJournalWatch_Watch_AppApp: App {
    @WKApplicationDelegateAdaptor(WatchApplicationDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
