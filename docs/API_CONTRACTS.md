# Hợp Đồng API Cloud Functions

Các hàm dưới đây là callable HTTPS Functions, trừ khi có ghi chú khác.

Web app có thể gọi các hàm ghi dữ liệu qua `VITE_FUNCTION_WRITE_MODE=auto|required`. Khi dùng `required`, client không fallback về ghi Firestore trực tiếp.

## createSalon

Input:

```json
{
  "name": "Salon Nam",
  "address": "123 Đường A",
  "phone": "0900000000"
}
```

Output:

```json
{ "salonId": "..." }
```

Cần đăng nhập Firebase.

## createStaffProfile

Input:

```json
{
  "salonId": "...",
  "uid": "...",
  "name": "Thợ Nam",
  "phone": "0900000001",
  "canRedeemRewards": true
}
```

Chỉ chủ salon được gọi.

## createMirror

Input:

```json
{
  "salonId": "...",
  "name": "Gương số 1"
}
```

Chỉ chủ salon được gọi.

## createManualCustomer

Input:

```json
{
  "salonId": "...",
  "name": "Nguyễn Văn A",
  "phone": "0900000000",
  "birthday": "1998-01-01",
  "allowPhoto": true
}
```

Output:

```json
{ "customerId": "..." }
```

Dùng khi khách không quét QR hoặc không dùng Zalo.

## registerCustomerFromZalo

Input:

```json
{
  "salonId": "...",
  "mirrorId": "...",
  "qrToken": "...",
  "zaloUserId": "...",
  "name": "Nguyễn Văn A",
  "phone": "84900000000",
  "birthday": "1998-01-01",
  "allowPhoto": true
}
```

Output:

```json
{
  "customerId": "...",
  "sessionId": "...",
  "points": 0
}
```

Production phải xác minh Zalo token ở server trước khi tin dữ liệu khách.

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

Chủ salon hoặc nhân viên được gọi.

## approvePointRequest

Input:

```json
{
  "salonId": "...",
  "requestId": "..."
}
```

Chỉ chủ salon được gọi. Khi duyệt, hệ thống tăng điểm, tạo lịch sử cắt tóc và đóng phiên phục vụ.

## rejectPointRequest

Input:

```json
{
  "salonId": "...",
  "requestId": "...",
  "reason": "Chủ salon từ chối"
}
```

Chỉ chủ salon được gọi.

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

Chỉ chủ salon được gọi.

## spinLuckyWheel / spinLuckyWheelFromZalo

Trả về:

```json
{
  "rewardId": "...",
  "rewardName": "Giảm 10%",
  "rewardCode": "HC-1234",
  "pointsAfter": 0
}
```

Bản production nên quay thưởng ở server để tránh gian lận.

## redeemRewardCode

Input:

```json
{
  "salonId": "...",
  "rewardCode": "HC-1234"
}
```

Chủ salon hoặc nhân viên có quyền xác nhận mã quà được gọi.
