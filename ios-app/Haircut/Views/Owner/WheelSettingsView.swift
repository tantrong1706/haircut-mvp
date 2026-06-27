import SwiftUI

struct WheelSettingsView: View {
    @EnvironmentObject private var viewModel: SalonViewModel
    @State private var config = LuckyWheelConfig.defaultConfig

    var body: some View {
        NavigationStack {
            Form {
                Section("Điều kiện quay") {
                    Stepper("Cần \(config.requiredPoints) điểm", value: $config.requiredPoints, in: 1...50)
                    Toggle("Trừ điểm sau khi quay", isOn: $config.deductPointsAfterSpin)
                }

                Section("6 ô giải thưởng") {
                    ForEach(config.slots.indices, id: \.self) { index in
                        HStack {
                            Text("\(index + 1)")
                                .frame(width: 24)
                            TextField("Tên phần thưởng", text: $config.slots[index].label)
                            Toggle("", isOn: $config.slots[index].active)
                                .labelsHidden()
                        }
                    }
                }

                Section {
                    Button(viewModel.isSaving ? "Đang lưu..." : "Lưu vòng quay") {
                        Task { await viewModel.updateWheel(config: config) }
                    }
                    .disabled(viewModel.isSaving)
                }
            }
            .navigationTitle("Vòng quay")
        }
    }
}

