import SwiftUI

struct SessionDetailView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    let session: ChairSession
    let customer: Customer?
    @State private var note = ""

    var body: some View {
        Form {
            Section("Thông tin khách") {
                LabeledContent("Tên", value: customer?.name ?? "Đang tải")
                if let last4 = customer?.phoneLast4 {
                    LabeledContent("SĐT", value: "******\(last4)")
                }
                LabeledContent("Điểm", value: "\(customer?.points ?? 0)")
                LabeledContent(
                    "Lưu ảnh",
                    value: customer?.allowPhoto == true ? "Khách đồng ý" : "Không lưu ảnh"
                )
            }

            Section("Phiên phục vụ") {
                LabeledContent("Gương", value: viewModel.mirrorName(mirrorId: session.mirrorId))
                LabeledContent("Trạng thái", value: session.status == "waiting" ? "Vừa quét QR" : "Đang phục vụ")
            }

            Section("Ghi chú kiểu tóc") {
                TextEditor(text: $note)
                    .frame(minHeight: 160)
            }

            Section {
                Button(viewModel.isSaving ? "Đang gửi..." : "Gửi yêu cầu cộng 1 điểm") {
                    Task {
                        await viewModel.submitPointRequest(session: session, note: note)
                    }
                }
                .disabled(viewModel.isSaving || note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if let error = viewModel.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Chi tiết khách")
    }
}

