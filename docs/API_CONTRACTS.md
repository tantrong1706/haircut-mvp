# Hợp đồng API Cloud Functions

Các hàm dưới đây là callable HTTPS Functions. Web app nên dùng `VITE_FUNCTION_WRITE_MODE=required` khi chạy pilot thật để mọi thao tác nghiệp vụ đi qua Cloud Functions.

Luồng khách Zalo không tin `zaloUserId` do client tự gửi. Client lấy `zaloAccessToken` bằng `getAccessToken()` của `zmp-sdk`, gửi token lên Cloud Functions; server dùng `ZALO_APP_SECRET` để gọi Zalo Open API và tự suy ra user id thật.

## Biến môi trường Functions

```env
ZALO_MINI_APP_ID=...
ZALO_APP_SECRET=...
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
  "mirrorId": "...",
  "qrUrl": "..."
}
```

Hàm này tự tạo hồ sơ owner, vòng quay mặc định và `Gương 1` để chủ salon có QR đầu tiên ngay sau khi đăng ký.

## createStaffProfile

Input:

```json
{
  "salonId": "...",
  "email": "staff@salon.com",
  "password": "matkhau-tam",
  "name": "Thợ Nam",
  "phone": "0900000001",
  "canRedeemRewards": true
}
```

Chỉ chủ salon được gọi. Server tạo tài khoản Firebase Auth cho nhân viên, rồi gắn hồ sơ `users/{uid}` vào salon. Trường `uid` vẫn được hỗ trợ nội bộ nếu cần gắn một tài khoản Auth đã tồn tại.

## updateStaffProfile / listStaffProfiles

Owner quản lý tên, số nội bộ, trạng thái kích hoạt và quyền đổi mã quà của nhân viên.

## createMirror / updateMirror

Owner tạo, bật/tắt, đổi tên hoặc tạo lại `qrToken` cho từng gương/ghế.

## registerCustomerFromZalo

Input:

```json
{
  "salonId": "...",
  "mirrorId": "...",
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

Owner hoặc staff được gọi. Server luôn cố định cộng 1 điểm, không tin số điểm do client tự gửi.

## approvePointRequest / rejectPointRequest

Chỉ owner được gọi. Khi duyệt, server tăng điểm, tạo `haircut_records` và đóng phiên phục vụ. Khi từ chối, yêu cầu điểm chuyển sang `rejected`.

## updateLuckyWheel

Input:

```json
{
  "salonId": "...",
  "requiredPoints": 5,
  "deductPointsAfterSpin": true,
  "slots": [
    { "label": "Giảm 10%", "active": true },
    { "label": "Gội đầu miễn phí", "active": true },
    { "label": "Tặng sáp tóc", "active": true },
    { "label": "Giảm 20%", "active": true },
    { "label": "Chúc bạn may mắn", "active": true },
    { "label": "Hấp dầu miễn phí", "active": true }
  ]
}
```

Chỉ owner được gọi.

## spinLuckyWheelFromZalo

Input:

```json
{
  "salonId": "...",
  "zaloAccessToken": "..."
}
```

Output:

```json
{
  "rewardId": "...",
  "rewardName": "Giảm 10%",
  "rewardCode": "HC-20260701-ABCD1234",
  "pointsAfter": 0,
  "selectedIndex": 0
}
```

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

## deleteCustomerData

Input:

```json
{
  "salonId": "...",
  "customerId": "..."
}
```

Chỉ owner được gọi. Hàm xóa hồ sơ khách, lịch sử cắt, mã quà, yêu cầu điểm, phiên ghế và ảnh Storage trong thư mục khách.
