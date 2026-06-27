import SwiftUI

struct StaffRootView: View {
    @EnvironmentObject private var authSession: AuthSession
    let user: AppUser

    var body: some View {
        TabView {
            ActiveSessionsView(user: user)
                .tabItem { Label("Đang phục vụ", systemImage: "person.crop.circle.badge.checkmark") }

            RedeemRewardView()
                .tabItem { Label("Đổi quà", systemImage: "ticket.fill") }

            StaffProfileView(user: user)
                .tabItem { Label("Tài khoản", systemImage: "person.fill") }
        }
    }
}

private struct StaffProfileView: View {
    @EnvironmentObject private var authSession: AuthSession
    let user: AppUser

    var body: some View {
        NavigationStack {
            List {
                LabeledContent("Tên", value: user.name)
                LabeledContent("Vai trò", value: "Nhân viên")
                LabeledContent("Đổi quà", value: user.canRedeemRewards ? "Được phép" : "Không")

                Button("Đăng xuất") {
                    authSession.signOut()
                }
                .foregroundStyle(.red)
            }
            .navigationTitle("Tài khoản")
        }
    }
}
