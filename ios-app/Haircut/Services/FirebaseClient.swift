import FirebaseFirestore
import FirebaseFunctions
import Foundation

final class FirebaseClient {
    static let shared = FirebaseClient()

    private let db = Firestore.firestore()
    private let functions = Functions.functions(region: "asia-southeast1")

    private init() {}

    func listenUser(uid: String, onChange: @escaping (AppUser?) -> Void) -> ListenerRegistration {
        db.collection("users").document(uid).addSnapshotListener { snapshot, _ in
            guard let snapshot, snapshot.exists, let data = snapshot.data() else {
                onChange(nil)
                return
            }
            onChange(Self.mapUser(id: snapshot.documentID, data: data))
        }
    }

    func listenActiveSessions(
        salonId: String,
        onChange: @escaping ([ChairSession]) -> Void
    ) -> ListenerRegistration {
        db.collection("chair_sessions")
            .whereField("salonId", isEqualTo: salonId)
            .whereField("status", in: ["waiting", "serving"])
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let sessions = snapshot?.documents.compactMap {
                    Self.mapSession(id: $0.documentID, data: $0.data())
                } ?? []
                onChange(sessions)
            }
    }

    func listenPendingRequests(
        salonId: String,
        onChange: @escaping ([PointRequest]) -> Void
    ) -> ListenerRegistration {
        db.collection("point_requests")
            .whereField("salonId", isEqualTo: salonId)
            .whereField("status", isEqualTo: "pending")
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { snapshot, _ in
                let requests = snapshot?.documents.compactMap {
                    Self.mapPointRequest(id: $0.documentID, data: $0.data())
                } ?? []
                onChange(requests)
            }
    }

    func listenCustomers(
        salonId: String,
        onChange: @escaping ([Customer]) -> Void
    ) -> ListenerRegistration {
        db.collection("customers")
            .whereField("salonId", isEqualTo: salonId)
            .order(by: "lastVisitAt", descending: true)
            .limit(to: 100)
            .addSnapshotListener { snapshot, _ in
                let customers = snapshot?.documents.compactMap {
                    Self.mapCustomer(id: $0.documentID, data: $0.data())
                } ?? []
                onChange(customers)
            }
    }

    func listenMirrors(
        salonId: String,
        onChange: @escaping ([Mirror]) -> Void
    ) -> ListenerRegistration {
        db.collection("mirrors")
            .whereField("salonId", isEqualTo: salonId)
            .order(by: "createdAt")
            .addSnapshotListener { snapshot, _ in
                let mirrors = snapshot?.documents.compactMap {
                    Self.mapMirror(id: $0.documentID, data: $0.data())
                } ?? []
                onChange(mirrors)
            }
    }

    func createSalon(name: String, address: String, phone: String) async throws -> String {
        let result: [String: Any] = try await call(
            "createSalon",
            data: [
                "name": name,
                "address": address,
                "phone": phone
            ]
        )
        return result["salonId"] as? String ?? ""
    }

    func createMirror(salonId: String, name: String) async throws {
        let _: [String: Any] = try await call(
            "createMirror",
            data: [
                "salonId": salonId,
                "name": name
            ]
        )
    }

    func createManualCustomer(
        salonId: String,
        name: String,
        phone: String,
        birthday: String?,
        allowPhoto: Bool
    ) async throws {
        var data: [String: Any] = [
            "salonId": salonId,
            "name": name,
            "phone": phone,
            "allowPhoto": allowPhoto
        ]
        if let birthday, !birthday.isEmpty {
            data["birthday"] = birthday
        }

        let _: [String: Any] = try await call("createManualCustomer", data: data)
    }

    func createStaffProfile(
        salonId: String,
        uid: String,
        name: String,
        phone: String,
        canRedeemRewards: Bool
    ) async throws {
        let _: [String: Any] = try await call(
            "createStaffProfile",
            data: [
                "salonId": salonId,
                "uid": uid,
                "name": name,
                "phone": phone,
                "canRedeemRewards": canRedeemRewards
            ]
        )
    }

    func submitPointRequest(
        salonId: String,
        sessionId: String,
        note: String,
        photoUrls: [String],
        pointsRequested: Int
    ) async throws {
        let _: [String: Any] = try await call(
            "submitPointRequest",
            data: [
                "salonId": salonId,
                "sessionId": sessionId,
                "note": note,
                "photoUrls": photoUrls,
                "pointsRequested": pointsRequested
            ]
        )
    }

    func approvePointRequest(salonId: String, requestId: String) async throws {
        let _: [String: Any] = try await call(
            "approvePointRequest",
            data: [
                "salonId": salonId,
                "requestId": requestId
            ]
        )
    }

    func rejectPointRequest(salonId: String, requestId: String, reason: String) async throws {
        let _: [String: Any] = try await call(
            "rejectPointRequest",
            data: [
                "salonId": salonId,
                "requestId": requestId,
                "reason": reason
            ]
        )
    }

    func updateLuckyWheel(salonId: String, config: LuckyWheelConfig) async throws {
        let slots = config.slots.map { ["label": $0.label, "active": $0.active] }
        let _: [String: Any] = try await call(
            "updateLuckyWheel",
            data: [
                "salonId": salonId,
                "requiredPoints": config.requiredPoints,
                "deductPointsAfterSpin": config.deductPointsAfterSpin,
                "slots": slots
            ]
        )
    }

    func redeemRewardCode(salonId: String, rewardCode: String) async throws {
        let _: [String: Any] = try await call(
            "redeemRewardCode",
            data: [
                "salonId": salonId,
                "rewardCode": rewardCode
            ]
        )
    }

    private func call<T>(_ name: String, data: [String: Any]) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            functions.httpsCallable(name).call(data) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let data = result?.data as? T else {
                    continuation.resume(throwing: HaircutError.invalidResponse)
                    return
                }
                continuation.resume(returning: data)
            }
        }
    }

    private static func mapUser(id: String, data: [String: Any]) -> AppUser? {
        guard
            let salonId = data["salonId"] as? String,
            let name = data["name"] as? String,
            let roleValue = data["role"] as? String,
            let role = UserRole(rawValue: roleValue)
        else {
            return nil
        }
        return AppUser(
            id: id,
            salonId: salonId,
            name: name,
            phone: data["phone"] as? String,
            role: role,
            isActive: data["isActive"] as? Bool ?? false,
            canRedeemRewards: data["canRedeemRewards"] as? Bool ?? false
        )
    }

    private static func mapSession(id: String, data: [String: Any]) -> ChairSession? {
        guard
            let salonId = data["salonId"] as? String,
            let mirrorId = data["mirrorId"] as? String,
            let customerId = data["customerId"] as? String,
            let status = data["status"] as? String
        else {
            return nil
        }
        return ChairSession(
            id: id,
            salonId: salonId,
            mirrorId: mirrorId,
            customerId: customerId,
            status: status,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue()
        )
    }

    private static func mapPointRequest(id: String, data: [String: Any]) -> PointRequest? {
        guard
            let salonId = data["salonId"] as? String,
            let sessionId = data["sessionId"] as? String,
            let customerId = data["customerId"] as? String,
            let staffId = data["staffId"] as? String,
            let status = data["status"] as? String
        else {
            return nil
        }
        return PointRequest(
            id: id,
            salonId: salonId,
            sessionId: sessionId,
            customerId: customerId,
            staffId: staffId,
            note: data["note"] as? String ?? "",
            photoUrls: data["photoUrls"] as? [String] ?? [],
            pointsRequested: data["pointsRequested"] as? Int ?? 1,
            status: status,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue()
        )
    }

    private static func mapCustomer(id: String, data: [String: Any]) -> Customer? {
        guard
            let salonId = data["salonId"] as? String,
            let name = data["name"] as? String
        else {
            return nil
        }
        return Customer(
            id: id,
            salonId: salonId,
            name: name,
            phoneLast4: data["phoneLast4"] as? String,
            points: data["points"] as? Int ?? 0,
            allowPhoto: data["allowPhoto"] as? Bool ?? false,
            lastVisitAt: (data["lastVisitAt"] as? Timestamp)?.dateValue()
        )
    }

    private static func mapMirror(id: String, data: [String: Any]) -> Mirror? {
        guard
            let salonId = data["salonId"] as? String,
            let name = data["name"] as? String,
            let qrUrl = data["qrUrl"] as? String
        else {
            return nil
        }
        return Mirror(
            id: id,
            salonId: salonId,
            name: name,
            qrUrl: qrUrl,
            isActive: data["isActive"] as? Bool ?? false
        )
    }
}

enum HaircutError: Error {
    case invalidResponse
}
