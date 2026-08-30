# Thiết Kế Dữ Liệu

MVP dùng các collection cấp cao trong Firestore. Mỗi document nghiệp vụ đều có `salonId` để query và phân quyền đơn giản.

## salons

```text
salons/{salonId}
  name: string
  address: string?
  phone: string?
  avatarUrl: string?
  ownerId: string
  status: active | suspended | pending_deletion
  isActive: boolean
  plan: free | basic | pro | premium
  freeCustomerLimit: number
  pointPerVisit: number
  createdAt: timestamp
  updatedAt: timestamp
```

`salons/{salonId}.avatarUrl` là ảnh đại diện công khai của salon, độc lập với
`users/{uid}.avatarUrl` của owner/staff. Object được lưu tại
`salons/{salonId}/branding/avatar.webp`; khách chỉ nhận URL đã kiểm tra qua
`resolveCustomerQr`, không đọc trực tiếp document salon.

## users

Firebase Auth user cho chủ salon và nhân viên.

```text
users/{uid}
  salonId: string
  name: string
  avatarUrl: string?
  phone: string?
  role: owner | staff | system_admin
  isActive: boolean
  canRedeemRewards: boolean
  canAwardPointsDirectly: boolean
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
  status: waiting | serving | pending_approval | completed | cancelled
  assignedStaffId: string?
  assignedStaffName: string?
  claimedAt: timestamp?
  expiresAt: timestamp
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
  status: waiting | serving | pending_approval
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
  approvalMode: staff_direct | owner_direct | owner_approval
  idempotencyKey: string
  processedAt: timestamp?
  processedBy: string?
  pointsBefore: number?
  pointsAfter: number?
  createdAt: timestamp
  updatedAt: timestamp?
```

## staff_daily_point_awards

Bộ đếm server-only giới hạn nhân viên tin cậy tối đa 100 lượt cộng điểm trực tiếp mỗi ngày Việt Nam.
Client không được đọc hoặc ghi collection này.

```text
staff_daily_point_awards/{hash(salonId + staffId + dateKey)}
  salonId: string
  staffId: string
  dateKey: YYYY-MM-DD
  awards: number
  pointsAwarded: number
  updatedAt: timestamp
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
  configVersion: number
  requiredPoints: number
  rewardValidityDays: number
  deductPointsAfterSpin: boolean
  slots: [
    {
      slotId: string,
      label: string,
      type: reward | no_prize,
      active: boolean,
      weight: positive integer
    }
  ]
  updatedAt: timestamp
```

## reward_history

```text
reward_history/{rewardId}
  salonId: string
  branchId: string
  sourceBranchId: string
  sourceBranchName: string
  sourceSlotId: string
  wheelConfigVersion: number
  wheelSlotWeight: number
  customerId: string
  zaloUserId: string?
  rewardName: string
  rewardCode: string
  status: unused | used | expired | revoked | no_prize
  pointsUsed: number?
  pointsSpent: number?
  redemptionScope: salon | branches
  allowedBranchIds: string[]?
  createdAt: timestamp
  usedAt: timestamp?
  usedBy: string?
  usedBranchId: string?
  usedBranchName: string?
  redemptionIdempotencyKey: string?
  expiresAt: timestamp?
  restoredAt: timestamp?
  restoredBy: string?
  restoreReason: string?
```

## audit_events

```text
audit_events/{eventId}
  salonId: string
  branchId: string?
  actorUid: string
  actorRole: owner | staff | system_admin | customer | system
  action: string
  targetType: string
  targetId: string
  requestId: string
  before: map?
  after: map?
  metadata: map?
  createdAt: timestamp
```

Không lưu token, phone/email đầy đủ, ghi chú, URL ảnh riêng tư hoặc reward code đầy đủ trong audit.

## device_tokens

Mỗi thiết bị có một document ID là SHA-256 của FCM token; không dùng một token duy nhất trong user.

```text
device_tokens/{tokenHash}
  uid: string
  salonId: string
  role: owner | staff
  branchIds: string[]
  platform: ios | android
  token: string
  appVersion: string
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
```

## support_requests

Collection dành cho yêu cầu hỗ trợ của owner/staff. Client không đọc hoặc ghi trực tiếp; callable tương lai phải tự lấy tenant từ `users/{uid}` và không tin `salonId`, `role` hoặc `branchIds` do client gửi.

```text
support_requests/{requestId}
  salonId: string
  branchId: string?
  requestedBy: string
  requesterRole: owner | staff
  category: string
  status: open | in_progress | resolved | closed
  createdAt: timestamp
  updatedAt: timestamp
```

Nội dung hỗ trợ có thể chứa thông tin vận hành và chỉ được phục vụ qua Cloud Functions có kiểm tra tenant; không đưa nội dung này vào Analytics, Sentry hoặc audit metadata.

## Feature flags

```text
system_config/features
salons/{salonId}/settings/features
  checkinEnabled: boolean
  luckyWheelEnabled: boolean
  rewardRedeemEnabled: boolean
  photoUploadEnabled: boolean
  pointApprovalEnabled: boolean
  maintenanceMode: boolean
  minimumSupportedAppVersion: string
  recommendedAppVersion: string
```

## Xóa dữ liệu

- `customer_deletion_jobs`: job idempotent từ owner hoặc Zalo webhook.
- `salon_deletion_jobs/{salonId}`: yêu cầu xóa toàn tenant, có `executeAfter`, lease, retry và trạng thái.
- `_public_rate_limits`, `_authenticated_rate_limits`, `idempotency_keys`: document kỹ thuật có TTL; client không được đọc/ghi.

## Dữ liệu cũ thiếu tenant

Không tự suy đoán `salonId`. Chạy `npm run audit:tenant-data -- --project <id>` chỉ để đếm; muốn ghi phải cung cấp mapping đã duyệt, `--apply` và `--confirm-project`. Công cụ không được chạy tự động trong request production.
