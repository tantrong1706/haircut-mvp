import FirebaseCore
import SwiftUI

@main
struct HaircutApp: App {
    @StateObject private var authSession = AuthSession()

    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authSession)
                .task {
                    authSession.start()
                }
        }
    }
}

