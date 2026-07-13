# Thiết Kế Dữ Liệu

MVP dùng các collection cấp cao trong Firestore. Mỗi document nghiệp vụ đều có `salonId` để query và phân quyền đơn giản.

## salons

```text
salons/{salonId}
  name: string
  address: string?
  phone: string?
  ownerId: string
  plan: free | basic | pro | premium
  freeCustomerLimit: number
  pointPerVisit: number
  createdAt: timestamp
  updatedAt: timestamp
```

## users

Firebase Auth user cho chủ salon và nhân viên.

```text
users/{uid}
  salonId: string
  name: string
  avatarUrl: string?
  phone: string?
  role: owner | staff
  isActive: boolean
  canRedeemRewards: boolean
  branchId: string?
  branchIds: string[]
  createdAt: timestamp
  updatedAt: timestamp
```

## branches

```text
branches/{branchId}
  salonId: string
  name: string
  address: string?
  phone: string?
  isActive: boolean
  qrVersion: number
  createdAt: timestamp
  updatedAt: timestamp
```

`salons/{salonId}.salonQrVersion` điều khiển QR chung. Token QR salon/chi nhánh được ký tại
Functions bằng `QR_SIGNING_SECRET`; Firestore không lưu token thô. `mirrors` được giữ nguyên chỉ để
QR Gương 1 cũ hoạt động trong giai đoạn chuyển đổi và mỗi mirror cũ được gắn `branchId`.

## customers

Hồ sơ khách hàng. Trên UI không nên gọi đây là “tài khoản khách”.

```text
customers/{customerId}
  salonId: string
  zaloUserId: string?
  name: string
  phone: string?
  phoneLast4: string?
  birthday: string?
  points: number
  allowPhoto: boolean
  createdAt: timestamp
  updatedAt: timestamp
  lastVisitAt: timestamp?
```

## chair_sessions

```text
chair_sessions/{sessionId}
  salonId: string
  branchId: string
  branchName: string
  branchAddress: string?
  qrType: salon | branch | legacy-mirror
  legacyMirrorId: string?
  customerId: string
  zaloUserId: string?
  status: waiting | serving | completed | cancelled
  createdAt: timestamp
  updatedAt: timestamp?
```

## active_service_sessions

Khóa phiên đang hoạt động theo từng khách trong từng salon. Collection này ngăn một khách quét QR nhiều lần để tạo nhiều phiên chờ trong cùng thời gian phục vụ.

```text
active_service_sessions/{hash(salonId + customerId)}
  salonId: string
  customerId: string
  sessionId: string
  branchId: string
  branchName: string
  status: waiting | serving
  createdAt: timestamp
  updatedAt: timestamp
```

## point_requests

```text
point_requests/{requestId}
  salonId: string
  branchId: string
  branchName: string
  sessionId: string
  customerId: string
  staffId: string?
  staffName: string?
  note: string
  photoUrls: string[]
  pointsAdded: number
  pointsRequested: number?
  status: pending | approved | rejected
  createdAt: timestamp
  updatedAt: timestamp?
```

## haircut_records

```text
haircut_records/{recordId}
  salonId: string
  branchId: string
  branchName: string
  customerId: string
  staffId: string?
  staffName: string?
  pointRequestId: string?
  note: string
  photoUrls: string[]
  pointsAdded: number
  approvedBy: string?
  createdAt: timestamp
```

## lucky_wheel

```text
lucky_wheel/{salonId}
  salonId: string
  requiredPoints: number
  deductPointsAfterSpin: boolean
  slots: [
    { label: string, active: boolean }
  ]
  updatedAt: timestamp
```

## reward_history

```text
reward_history/{rewardId}
  salonId: string
  customerId: string
  zaloUserId: string?
  rewardName: string
  rewardCode: string
  status: unused | used | expired
  pointsUsed: number?
  pointsSpent: number?
  createdAt: timestamp
  usedAt: timestamp?
  usedBy: string?
```
