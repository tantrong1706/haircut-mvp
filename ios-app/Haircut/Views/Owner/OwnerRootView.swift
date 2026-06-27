import SwiftUI

struct OwnerRootView: View {
    @EnvironmentObject private var authSession: AuthSession
    let user: AppUser

    var body: some View {
        TabView {
            OwnerDashboardView(user: user)
                .tabItem { Label("Tổng quan", systemImage: "chart.bar.fill") }

            ApprovalsView()
                .tabItem { Label("Duyệt", systemImage: "checkmark.seal.fill") }

            CustomersView()
                .tabItem { Label("Khách", systemImage: "person.2.fill") }

            MirrorsView()
                .tabItem { Label("QR", systemImage: "qrcode") }

            WheelSettingsView()
                .tabItem { Label("Vòng quay", systemImage: "gift.fill") }

            RedeemRewardView()
                .tabItem { Label("Đổi quà", systemImage: "ticket.fill") }

            StaffManagementView()
                .tabItem { Label("Nhân viên", systemImage: "person.badge.plus") }
        }
    }
}
