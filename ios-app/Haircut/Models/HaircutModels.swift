import Foundation

enum UserRole: String, Codable {
    case owner
    case staff
}

struct AppUser: Identifiable, Equatable {
    let id: String
    var salonId: String
    var name: String
    var phone: String?
    var role: UserRole
    var isActive: Bool
    var canRedeemRewards: Bool
}

struct Salon: Identifiable, Equatable {
    let id: String
    var name: String
    var address: String?
    var phone: String?
    var ownerId: String
    var plan: String
    var pointPerVisit: Int
}

struct Mirror: Identifiable, Equatable {
    let id: String
    var salonId: String
    var name: String
    var qrUrl: String
    var isActive: Bool
}

struct Customer: Identifiable, Equatable {
    let id: String
    var salonId: String
    var name: String
    var phoneLast4: String?
    var points: Int
    var allowPhoto: Bool
    var lastVisitAt: Date?
}

struct ChairSession: Identifiable, Equatable {
    let id: String
    var salonId: String
    var mirrorId: String
    var customerId: String
    var status: String
    var createdAt: Date?
}

struct PointRequest: Identifiable, Equatable {
    let id: String
    var salonId: String
    var sessionId: String
    var customerId: String
    var staffId: String
    var note: String
    var photoUrls: [String]
    var pointsRequested: Int
    var status: String
    var createdAt: Date?
}

struct HaircutRecord: Identifiable, Equatable {
    let id: String
    var salonId: String
    var customerId: String
    var staffId: String
    var note: String
    var photoUrls: [String]
    var pointsAdded: Int
    var createdAt: Date?
}

struct WheelSlot: Identifiable, Equatable {
    var id = UUID()
    var label: String
    var active: Bool
}

struct LuckyWheelConfig: Equatable {
    var requiredPoints: Int
    var deductPointsAfterSpin: Bool
    var slots: [WheelSlot]

    static let defaultConfig = LuckyWheelConfig(
        requiredPoints: 5,
        deductPointsAfterSpin: true,
        slots: [
            WheelSlot(label: "Giảm 10%", active: true),
            WheelSlot(label: "Gội miễn phí", active: true),
            WheelSlot(label: "Tặng sáp", active: true),
            WheelSlot(label: "Giảm 20%", active: true),
            WheelSlot(label: "Chúc may mắn", active: true),
            WheelSlot(label: "Hấp dầu", active: true)
        ]
    )
}

