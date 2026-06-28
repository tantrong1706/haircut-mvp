import FirebaseFirestore
import Foundation

@MainActor
final class SalonViewModel: ObservableObject {
    @Published var activeSessions: [ChairSession] = []
    @Published var pendingRequests: [PointRequest] = []
    @Published var customers: [Customer] = []
    @Published var mirrors: [Mirror] = []
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    private var listeners: [ListenerRegistration] = []
    private let client = FirebaseClient.shared
    private var user: AppUser?

    func start(user: AppUser) {
        guard self.user != user else { return }
        stop()
        self.user = user
        listeners = [
            client.listenActiveSessions(salonId: user.salonId) { [weak self] sessions in
                Task { @MainActor in self?.activeSessions = sessions }
            },
            client.listenPendingRequests(salonId: user.salonId) { [weak self] requests in
                Task { @MainActor in self?.pendingRequests = requests }
            },
            client.listenCustomers(salonId: user.salonId) { [weak self] customers in
                Task { @MainActor in self?.customers = customers }
            },
            client.listenMirrors(salonId: user.salonId) { [weak self] mirrors in
                Task { @MainActor in self?.mirrors = mirrors }
            }
        ]
    }

    func stop() {
        listeners.forEach { $0.remove() }
        listeners = []
    }

    func customer(for session: ChairSession) -> Customer? {
        customers.first { $0.id == session.customerId }
    }

    func customerName(customerId: String) -> String {
        customers.first { $0.id == customerId }?.name ?? "Khách"
    }

    func customerPhoneLast4(customerId: String) -> String? {
        customers.first { $0.id == customerId }?.phoneLast4
    }

    func mirrorName(mirrorId: String) -> String {
        mirrors.first { $0.id == mirrorId }?.name ?? "Gương"
    }

    func createSalon(name: String, address: String, phone: String) async {
        await runSaving {
            _ = try await client.createSalon(name: name, address: address, phone: phone)
        }
    }

    func createMirror(name: String) async {
        guard let user else { return }
        await runSaving {
            try await client.createMirror(salonId: user.salonId, name: name)
        }
    }

    func createManualCustomer(
        name: String,
        phone: String,
        birthday: String?,
        allowPhoto: Bool
    ) async {
        guard let user else { return }
        await runSaving(success: "Đã tạo hồ sơ khách") {
            try await client.createManualCustomer(
                salonId: user.salonId,
                name: name,
                phone: phone,
                birthday: birthday,
                allowPhoto: allowPhoto
            )
        }
    }

    func createStaff(uid: String, name: String, phone: String, canRedeemRewards: Bool) async {
        guard let user else { return }
        await runSaving {
            try await client.createStaffProfile(
                salonId: user.salonId,
                uid: uid,
                name: name,
                phone: phone,
                canRedeemRewards: canRedeemRewards
            )
        }
    }

    func submitPointRequest(session: ChairSession, note: String) async {
        guard let user else { return }
        await runSaving {
            try await client.submitPointRequest(
                salonId: user.salonId,
                sessionId: session.id,
                note: note,
                photoUrls: [],
                pointsRequested: 1
            )
        }
    }

    func approve(_ request: PointRequest) async {
        guard let user else { return }
        await runSaving {
            try await client.approvePointRequest(salonId: user.salonId, requestId: request.id)
        }
    }

    func reject(_ request: PointRequest) async {
        guard let user else { return }
        await runSaving {
            try await client.rejectPointRequest(
                salonId: user.salonId,
                requestId: request.id,
                reason: "Chủ salon từ chối"
            )
        }
    }

    func updateWheel(config: LuckyWheelConfig) async {
        guard let user else { return }
        await runSaving {
            try await client.updateLuckyWheel(salonId: user.salonId, config: config)
        }
    }

    func redeemRewardCode(_ code: String) async {
        guard let user else { return }
        await runSaving(success: "Đã đánh dấu quà là đã sử dụng") {
            try await client.redeemRewardCode(salonId: user.salonId, rewardCode: code)
        }
    }

    private func runSaving(success: String? = nil, _ operation: () async throws -> Void) async {
        isSaving = true
        errorMessage = nil
        successMessage = nil
        do {
            try await operation()
            successMessage = success
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}
