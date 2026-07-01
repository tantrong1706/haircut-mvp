# HAIRCUT Web/Zalo Mini App

Đây là app web/PWA hiện tại cho khách, nhân viên và chủ salon. Khi đưa vào Zalo Mini App production, màn khách là luồng chính: khách quét QR tại gương, xác nhận tên hiển thị, rồi salon xử lý điểm/lịch sử/quà.

## Chạy Dev

```bash
cd haircut/zalo-mini-app
npm install
npm run dev
```

Mở URL kèm tham số test:

```text
http://localhost:5173/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token
```

Lưu ý: khi Firebase đã cấu hình, luồng khách thật cần mở trong Zalo để lấy `zaloAccessToken`. Web ngoài Zalo chỉ nên dùng để xem giao diện hoặc test owner/staff.

## Kết Nối Firebase

```bash
cp .env.example .env
```

Điền Firebase web config vào `.env`.

## Chế Độ Cloud Functions

Trong `.env` có biến:

```text
VITE_FUNCTION_WRITE_MODE=required
```

Giá trị:

- `direct`: chỉ dùng cho test nội bộ, Firestore phải còn mở cho dev.
- `auto`: thử gọi Cloud Functions rồi fallback nếu lỗi; không dùng cho pilot thật.
- `required`: production, bắt buộc gọi Cloud Functions.

Muốn khóa Firestore rules và chạy salon thật thì phải deploy Functions rồi đổi sang `required`.

## Quyền Zalo

- `getAccessToken`: bắt buộc cho luồng khách thật. Token được gửi lên Cloud Functions để server xác minh và suy ra `zaloUserId`.
- `getUserInfo`: chỉ dùng để điền sẵn tên/avatar cho khách, khách vẫn có thể sửa tên hiển thị tại salon.
- `getPhoneNumber`: chỉ gọi khi thật sự cần và đã giải thích lý do cho khách.

Không ép khách cung cấp số điện thoại ngay màn đầu nếu salon chưa thật sự cần.
