import SwiftUI

struct CreateSalonView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @EnvironmentObject private var authSession: AuthSession
    @State private var name = ""
    @State private var address = ""
    @State private var phone = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Tạo salon") {
                    TextField("Tên salon", text: $name)
                    TextField("Địa chỉ", text: $address)
                    TextField("Số điện thoại", text: $phone)
                        .keyboardType(.phonePad)
                }

                Section {
                    Button(viewModel.isSaving ? "Đang tạo..." : "Tạo salon") {
                        Task {
                            await viewModel.createSalon(name: name, address: address, phone: phone)
                        }
                    }
                    .disabled(name.isEmpty || viewModel.isSaving)

                    Button("Đăng xuất") {
                        authSession.signOut()
                    }
                    .foregroundStyle(.red)
                }

                if let error = viewModel.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Thiết lập ban đầu")
        }
    }
}

