import SwiftUI

struct OwnerDashboardView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @EnvironmentObject private var authSession: AuthSession
    let user: AppUser

    var body: some View {
        NavigationStack {
            List {
                Section {
                    MetricRow(title: "Khách đang phục vụ", value: "\(viewModel.activeSessions.count)")
                    MetricRow(title: "Yêu cầu chờ duyệt", value: "\(viewModel.pendingRequests.count)")
                    MetricRow(title: "Tổng khách đã lưu", value: "\(viewModel.customers.count)")
                    MetricRow(title: "QR gương", value: "\(viewModel.mirrors.count)")
                }

                Section("Tài khoản") {
                    LabeledContent("Tên", value: user.name)
                    LabeledContent("Vai trò", value: "Chủ salon")
                    Button("Đăng xuất") {
                        authSession.signOut()
                    }
                    .foregroundStyle(.red)
                }
            }
            .navigationTitle("Tổng quan")
        }
    }
}

private struct MetricRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(.green)
        }
    }
}

