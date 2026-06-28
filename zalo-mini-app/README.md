# HAIRCUT Web/Zalo Mini App

Đây là app web hiện tại cho khách, nhân viên và chủ salon. Khi đưa vào Zalo Mini App production, màn khách sẽ là luồng chính.

## Chạy dev

```bash
cd haircut/zalo-mini-app
npm install
npm run dev
```

Mở URL kèm tham số test:

```text
http://localhost:5173/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token
```

Nếu thiếu `.env`, app chạy bằng dữ liệu giả để xem giao diện.

## Kết nối Firebase

```bash
cp .env.example .env
```

Điền Firebase web config vào `.env`.

## Quyền Zalo

Nên dùng:

- `getUserInfo` để nhận diện khách.
- `getPhoneNumber` chỉ sau khi giải thích vì sao cần số điện thoại.

Không ép khách cung cấp số điện thoại ngay màn đầu nếu salon chưa thật sự cần.
