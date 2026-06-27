import SwiftUI

struct ApprovalsView: View {
    @EnvironmentObject private var viewModel: SalonViewModel

    var body: some View {
        NavigationStack {
            List {
                if viewModel.pendingRequests.isEmpty {
                    ContentUnavailableView(
                        "Chưa có yêu cầu",
                        systemImage: "checkmark.circle",
                        description: Text("Yêu cầu cộng điểm của nhân viên sẽ hiện ở đây.")
                    )
                }

                ForEach(viewModel.pendingRequests) { request in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(viewModel.customerName(customerId: request.customerId))
                            .font(.headline)

                        if let last4 = viewModel.customerPhoneLast4(customerId: request.customerId) {
                            Text("SĐT: ******\(last4)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Text(request.note.isEmpty ? "Không có ghi chú" : request.note)
                            .foregroundStyle(.secondary)
                        Text("Điểm đề xuất: +\(request.pointsRequested)")
                            .font(.subheadline.bold())

                        HStack {
                            Button("Duyệt") {
                                Task { await viewModel.approve(request) }
                            }
                            .buttonStyle(.borderedProminent)

                            Button("Từ chối") {
                                Task { await viewModel.reject(request) }
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            .navigationTitle("Duyệt điểm")
        }
    }
}

