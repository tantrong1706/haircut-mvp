import SwiftUI

struct RootView: View {
    @EnvironmentObject private var authSession: AuthSession
    @StateObject private var salonViewModel = SalonViewModel()

    var body: some View {
        Group {
            if authSession.isLoading {
                ProgressView("Đang tải")
            } else if authSession.firebaseUser == nil {
                LoginView()
            } else if let appUser = authSession.appUser {
                RoleRouterView(user: appUser)
                    .environmentObject(salonViewModel)
                    .task {
                        salonViewModel.start(user: appUser)
                    }
            } else {
                CreateSalonView()
                    .environmentObject(salonViewModel)
            }
        }
    }
}

