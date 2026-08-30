# Hợp đồng API Cloud Functions

> Tài liệu tham khảo, chưa phải schema sinh tự động. Tên callable và validation trong `firebase/functions/src/index.ts` là hợp đồng thực thi; mọi thay đổi production phải đi kèm test Functions và cập nhật tài liệu này.

Các hàm dưới đây là callable HTTPS Functions. Web app nên dùng `VITE_FUNCTION_WRITE_MODE=required` khi chạy pilot thật để mọi thao tác nghiệp vụ đi qua Cloud Functions.

Luồng khách Zalo không tin `zaloUserId` do client tự gửi. Client lấy `zaloAccessToken` bằng `getAccessToken()` của `zmp-sdk`, gửi token lên Cloud Functions; server dùng `ZALO_APP_SECRET` để gọi Zalo Open API và tự suy ra user id thật.

## Biến môi trường Functions

```env
ZALO_MINI_APP_ID=...
ZALO_APP_SECRET=...
QR_SIGNING_SECRET=...
```

## createSalon

Input:

```json
{
  "name": "Salon Nam",
  "ownerName": "Anh Nam",
  "address": "123 Đường A",
  "phone": "0900000000"
}
```

Cần đăng nhập Firebase. Output:

```json
{
  "salonId": "...",
  "branchId": "...",
  "salonQrUrl": "...",
  "branchQrUrl": "..."
}
```

Hàm này tự tạo hồ sơ owner, vòng quay mặc định, `Chi nhánh chính`, QR chung và QR chi nhánh.

## createStaffProfile

Input:

```json
{
  "salonId": "...",
  "email": "staff@salon.com",
  "password": "matkhau-tam",
  "name": "Thợ Nam",
  "phone": "0900000001",
  "canRedeemRewards": true,
  "canAwardPointsDirectly": true,
  "branchIds": ["..."]
}
```

Chỉ chủ salon được gọi. Server tạo tài khoản Firebase Auth cho nhân viên, rồi gắn hồ sơ `users/{uid}` vào salon. Trường `uid` vẫn được hỗ trợ nội bộ nếu cần gắn một tài khoản Auth đã tồn tại.

## updateStaffProfile / listStaffProfiles

Owner quản lý tên, số nội bộ, trạng thái kích hoạt, chi nhánh phân công, quyền đổi mã quà và quyền
`canAwardPointsDirectly`. Quyền cộng trực tiếp chỉ áp dụng cho điểm chuẩn của salon, đúng lượt nhân viên
đang phục vụ và dưới hạn mức 100 lượt/ngày; trường hợp khác tự chuyển owner duyệt.

## updateOwnerAvatar

Input:

```json
{
  "salonId": "...",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

Chỉ owner của đúng salon được gọi. Gửi `avatarUrl` rỗng để xóa avatar. Server cập nhật cả `users/{uid}.avatarUrl` và `photoURL` trong Firebase Auth.

## updateSalonAvatar

Input:

```json
{
  "salonId": "...",
  "salonAvatarUrl": "https://firebasestorage.googleapis.com/..."
}
```

Chỉ owner của đúng salon được gọi. Server chỉ chấp nhận object
`salons/{salonId}/branding/avatar.webp` thuộc bucket Firebase của dự án, kiểm tra MIME, kích thước,
metadata `salonId`/`ownerUid` và ghi audit event. Gửi `salonAvatarUrl` rỗng để xóa ảnh salon.

## listBranches / createBranch / updateBranch

Owner xem, tạo, sửa và khóa chi nhánh. Staff chỉ nhận những chi nhánh được phân công.

## rotateSalonQr / rotateBranchQr

Mỗi API chỉ tăng phiên bản QR đúng phạm vi của mình. Xoay QR salon không ảnh hưởng QR chi nhánh và
xoay QR chi nhánh không ảnh hưởng QR salon.

## resolveCustomerQr / migrateSalonBranches

`resolveCustomerQr` xác minh QR và trả chi nhánh phù hợp, gồm `salonName`, `salonAvatarUrl`,
`branchName` và `branchAddress`; khi salon chưa có ảnh, `salonAvatarUrl` là chuỗi rỗng.
`migrateSalonBranches` tạo Chi nhánh chính, gắn `branchId` vào dữ liệu cũ và có thể chạy lại mà
không tạo trùng.

## registerCustomerFromZalo

Input:

```json
{
  "salonId": "...",
  "qrType": "salon | branch | legacy-mirror",
  "branchId": "...",
  "mirrorId": "... chỉ dành cho QR cũ",
  "qrToken": "...",
  "zaloAccessToken": "...",
  "name": "Nguyễn Văn A",
  "phone": "84900000000",
  "birthday": "1998-01-01",
  "allowPhoto": false
}
```

Output:

```json
{
  "customerId": "...",
  "sessionId": "...",
  "points": 0,
  "zaloUserId": "..."
}
```

`name` là tên hiển thị khách xác nhận tại salon. `zaloUserId` trong output là ID đã xác minh từ Zalo.
Token chỉ dùng trong request này, không được trả về, lưu trong session hay ghi vào Firestore.

## submitPointRequest

Input:

```json
{
  "salonId": "...",
  "sessionId": "...",
  "note": "Fade thấp, để mái dài",
  "photoUrls": [],
  "pointsRequested": 1
}
```

Owner hoặc staff được gọi. Server luôn lấy `pointPerVisit` từ salon, không tin số điểm do client tự gửi.
Server lấy `branchId` từ phiên đã xác minh; client không được tự chọn chi nhánh cho yêu cầu điểm.
Document request dùng `sessionId` làm ID/khóa xác định. Gửi lại cùng staff/session trả `alreadySubmitted=true`.
Owner hoặc staff có `canAwardPointsDirectly=true` được hoàn tất và cộng điểm ngay trong một transaction;
output có `status=approved`, `approvalMode` và `pointsAfter`. Staff thường hoặc staff đã đạt 100 lượt trực
tiếp trong ngày nhận `status=pending_approval` để owner duyệt. Cả hai nhánh đều chống cộng trùng theo
`sessionId` và ghi audit.

## approvePointRequest / rejectPointRequest

Chỉ owner được gọi. Khi duyệt, server tăng điểm, tạo `haircut_records` và đóng phiên phục vụ. Khi từ chối, yêu cầu điểm chuyển sang `rejected`.
Transaction ghi `processedAt`, `processedBy`, `pointsBefore` và `pointsAfter`; gọi lại không cộng điểm lần hai.

## updateLuckyWheel

Input:

```json
{
  "salonId": "...",
  "requiredPoints": 5,
  "rewardValidityDays": 90,
  "deductPointsAfterSpin": true,
  "slots": [
    { "slotId": "slot-1", "label": "Giảm 10%", "type": "reward", "active": true, "weight": 25 },
    { "slotId": "slot-2", "label": "Gội đầu miễn phí", "type": "reward", "active": true, "weight": 10 },
    { "slotId": "slot-3", "label": "Tặng sáp tóc", "type": "reward", "active": true, "weight": 10 },
    { "slotId": "slot-4", "label": "Giảm 20%", "type": "reward", "active": true, "weight": 5 },
    { "slotId": "slot-5", "label": "Không trúng", "type": "no_prize", "active": true, "weight": 40 },
    { "slotId": "slot-6", "label": "Hấp dầu miễn phí", "type": "reward", "active": true, "weight": 10 }
  ]
}
```

Chỉ owner được gọi. Mỗi lần lưu tăng `configVersion`; slot legacy thiếu `weight` dùng `1`, thiếu `slotId` dùng `slot-1...slot-6`.

## spinLuckyWheelFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloAccessToken": "...",
  "configVersion": 3,
  "idempotencyKey": "random-16-128-characters"
}
```

Output:

```json
{
  "rewardId": "...",
  "rewardName": "Giảm 10%",
  "rewardCode": "HC-20260701-ABCD1234ABCD1234",
  "pointsAfter": 0,
  "selectedIndex": 0,
  "selectedSlotId": "slot-1",
  "configVersion": 3
}
```

Nếu config client đã cũ, backend trả `STALE_WHEEL_CONFIG` trước khi trừ điểm hoặc tạo reward.

Kết quả quay được tạo trong transaction ở server. `selectedIndex` giúp frontend quay đúng ô.

## getCustomerHistoryFromZalo / getCustomerRewardsFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloAccessToken": "...",
  "limit": 20
}
```

Server xác minh token, tự suy ra `customerId`, rồi chỉ trả lịch sử hoặc mã quà của đúng khách đó.

## searchSalonCustomers

Owner/staff tìm khách theo tên hoặc 4 số cuối SĐT. Output gồm điểm, lịch sử gần đây và mã quà chưa dùng.

## lookupRewardCode / redeemRewardCode

Owner hoặc staff có `canRedeemRewards=true` được kiểm tra và xác nhận mã quà đã sử dụng.
`lookupRewardCode` và `redeemRewardCode` đều nhận `branchId`, nên UI biết reward có dùng được tại chi nhánh hiện tại trước khi hiện nút xác nhận.
Reward legacy hoặc `redemptionScope=salon` dùng được tại mọi chi nhánh active cùng salon; `redemptionScope=branches` chỉ dùng tại `allowedBranchIds`.
`redeemRewardCode` nhận thêm `idempotencyKey`, chạy transaction, ghi `usedAt` phía server và trả `usedAtMs`, `usedBy`, `usedBranchId`, `usedBranchName` authoritative.
Lookup trả `redeemableAtBranch` và `reason`: `OK`, `USED`, `EXPIRED`, `REVOKED`, `WRONG_BRANCH`, `NOT_FOUND`.

## Error code ổn định

Frontend hiển thị tiếng Việt từ `HttpsError.details.errorCode`, không so khớp toàn bộ message. Các mã chính nằm trong `@haircut/contracts`:

```text
UNAUTHENTICATED
FORBIDDEN
USER_INACTIVE
SALON_SUSPENDED
SALON_PENDING_DELETION
INVALID_SALON
INVALID_BRANCH
BRANCH_ACCESS_DENIED
SESSION_ALREADY_CLAIMED
SESSION_NOT_OPEN
REQUEST_ALREADY_PROCESSED
STALE_WHEEL_CONFIG
REWARD_ALREADY_REDEEMED
REWARD_EXPIRED
INVALID_REQUEST
RATE_LIMITED
APP_VERSION_UNSUPPORTED
FEATURE_DISABLED
MAINTENANCE_MODE
INTERNAL_ERROR
```

Tên callable dùng chung cũng được công bố bởi `CloudFunctionNames`; thay đổi tên production phải có giai đoạn tương thích.

## deleteCustomerData

Input:

```json
{
  "salonId": "...",
  "customerId": "..."
}
```

Chỉ owner được gọi. Hàm xóa hồ sơ khách, lịch sử cắt, mã quà, yêu cầu điểm, phiên ghế và ảnh Storage trong thư mục khách.
