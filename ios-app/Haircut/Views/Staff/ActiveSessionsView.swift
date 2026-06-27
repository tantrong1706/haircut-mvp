import SwiftUI

struct ActiveSessionsView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    let user: AppUser

    var body: some View {
        NavigationStack {
            List {
                if viewModel.activeSessions.isEmpty {
                    ContentUnavailableView(
                        "Chưa có khách",
                        systemImage: "qrcode.viewfinder",
                        description: Text("Khi khách quét QR tại gương, phiên phục vụ sẽ hiện ở đây.")
                    )
                }

                ForEach(viewModel.activeSessions) { session in
                    let customer = viewModel.customer(for: session)

                    NavigationLink {
                        SessionDetailView(session: session, customer: customer)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(viewModel.mirrorName(mirrorId: session.mirrorId))
                                .font(.headline)
                            Text(customerLine(customer))
                                .foregroundStyle(.secondary)
                            Text(statusLabel(session.status))
                                .font(.caption.bold())
                                .foregroundStyle(session.status == "waiting" ? .orange : .green)
                        }
                    }
                }
            }
            .navigationTitle("Khách đang phục vụ")
        }
    }

    private func customerLine(_ customer: Customer?) -> String {
        guard let customer else {
            return "Đang tải hồ sơ khách"
        }
        if let last4 = customer.phoneLast4 {
            return "\(customer.name) - ******\(last4) - \(customer.points) điểm"
        }
        return "\(customer.name) - \(customer.points) điểm"
    }

    private func statusLabel(_ status: String) -> String {
        status == "waiting" ? "Vừa quét QR" : "Đang phục vụ"
    }
}

