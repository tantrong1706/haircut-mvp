import SwiftUI

struct RedeemRewardView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @State private var rewardCode = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Mã quà") {
                    TextField("Ví dụ: HC-8291", text: $rewardCode)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button(viewModel.isSaving ? "Đang kiểm tra..." : "Đánh dấu đã sử dụng") {
                        Task {
                            await viewModel.redeemRewardCode(rewardCode.trimmingCharacters(in: .whitespacesAndNewlines))
                            rewardCode = ""
                        }
                    }
                    .disabled(rewardCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || viewModel.isSaving)
                }

                if let message = viewModel.successMessage {
                    Section {
                        Text(message)
                            .foregroundStyle(.green)
                    }
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Đổi quà")
        }
    }
}

