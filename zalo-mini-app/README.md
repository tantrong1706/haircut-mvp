# HAIRCUT Web/Zalo Mini App

Đây là app web/PWA hiện tại cho khách, nhân viên và chủ salon. Trong Zalo Mini App production, màn khách là luồng chính: khách quét QR có chữ ký của salon hoặc chi nhánh, xác nhận tên hiển thị, rồi salon xử lý điểm, lịch sử và quà.

## Chạy Dev

```bash
cd haircut/zalo-mini-app
npm install
npm run dev
```

Mở trang xem trước cục bộ:

```text
http://localhost:5173/
```

Lưu ý: URL cục bộ chỉ dùng để xem giao diện. Luồng reviewer và khách thật phải mở trong Zalo bằng QR salon/chi nhánh có chữ ký và phiên bản do hệ thống quản lý QR tạo. Không dùng QR gương cũ hoặc `qrToken` thô trong tài liệu, ảnh hay deeplink reviewer.

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
- Không dùng `getPhoneNumber`: số điện thoại là tùy chọn và chỉ được lưu khi khách tự nhập.
- Không dùng `scanQRCode`, vị trí, notification, theo dõi OA hoặc API chia sẻ trong Version 8.

Không ép khách cung cấp số điện thoại ngay màn đầu nếu salon chưa thật sự cần.
