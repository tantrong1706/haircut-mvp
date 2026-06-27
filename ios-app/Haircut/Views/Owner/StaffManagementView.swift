import SwiftUI

struct StaffManagementView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @State private var uid = ""
    @State private var name = ""
    @State private var phone = ""
    @State private var canRedeemRewards = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Thêm nhân viên") {
                    TextField("Firebase UID của nhân viên", text: $uid)
                        .textInputAutocapitalization(.never)
                    TextField("Tên nhân viên", text: $name)
                    TextField("Số điện thoại", text: $phone)
                        .keyboardType(.phonePad)
                    Toggle("Được xác nhận mã quà", isOn: $canRedeemRewards)
                }

                Section {
                    Button(viewModel.isSaving ? "Đang thêm..." : "Thêm nhân viên") {
                        Task {
                            await viewModel.createStaff(
                                uid: uid,
                                name: name,
                                phone: phone,
                                canRedeemRewards: canRedeemRewards
                            )
                            uid = ""
                            name = ""
                            phone = ""
                        }
                    }
                    .disabled(uid.isEmpty || name.isEmpty || viewModel.isSaving)
                }
            }
            .navigationTitle("Nhân viên")
        }
    }
}

