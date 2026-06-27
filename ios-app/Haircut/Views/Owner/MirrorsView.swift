import SwiftUI

struct MirrorsView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @State private var mirrorName = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Tạo QR gương") {
                    TextField("Ví dụ: Gương số 1", text: $mirrorName)
                    Button("Tạo QR") {
                        Task {
                            await viewModel.createMirror(name: mirrorName)
                            mirrorName = ""
                        }
                    }
                    .disabled(mirrorName.isEmpty || viewModel.isSaving)
                }

                Section("Danh sách QR") {
                    ForEach(viewModel.mirrors) { mirror in
                        NavigationLink {
                            MirrorQrDetailView(mirror: mirror)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(mirror.name)
                                    .font(.headline)
                                Text(mirror.isActive ? "Đang hoạt động" : "Đã tắt")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("QR gương")
        }
    }
}

private struct MirrorQrDetailView: View {
    let mirror: Mirror

    var body: some View {
        VStack(spacing: 18) {
            Text(mirror.name)
                .font(.title.bold())
            QRCodeView(text: mirror.qrUrl)
                .frame(width: 260, height: 260)
            Text(mirror.qrUrl)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .textSelection(.enabled)
        }
        .padding()
        .navigationTitle("In QR")
    }
}

