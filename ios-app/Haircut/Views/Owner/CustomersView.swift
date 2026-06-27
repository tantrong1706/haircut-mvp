import SwiftUI

struct CustomersView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @State private var name = ""
    @State private var phone = ""
    @State private var birthday = ""
    @State private var allowPhoto = false

    var body: some View {
        NavigationStack {
            List {
                Section("Thêm khách thủ công") {
                    TextField("Tên khách", text: $name)
                    TextField("Số điện thoại", text: $phone)
                        .keyboardType(.phonePad)
                    TextField("Ngày sinh, ví dụ 1998-01-01", text: $birthday)
                    Toggle("Khách đồng ý lưu ảnh", isOn: $allowPhoto)

                    Button(viewModel.isSaving ? "Đang tạo..." : "Tạo hồ sơ khách") {
                        Task {
                            await viewModel.createManualCustomer(
                                name: name,
                                phone: phone,
                                birthday: birthday.isEmpty ? nil : birthday,
                                allowPhoto: allowPhoto
                            )
                            name = ""
                            phone = ""
                            birthday = ""
                            allowPhoto = false
                        }
                    }
                    .disabled(name.isEmpty || viewModel.isSaving)
                }

                if let message = viewModel.successMessage {
                    Section {
                        Text(message)
                            .foregroundStyle(.green)
                    }
                }

                Section("Danh sách khách") {
                    ForEach(viewModel.customers) { customer in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(customer.name)
                                .font(.headline)
                            HStack {
                                Text(customer.phoneLast4.map { "******\($0)" } ?? "Chưa có SĐT")
                                Spacer()
                                Text("\(customer.points) điểm")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.green)
                            }
                            .foregroundStyle(.secondary)
                            Text(customer.allowPhoto ? "Đồng ý lưu ảnh" : "Không lưu ảnh")
                                .font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Khách hàng")
        }
    }
}

