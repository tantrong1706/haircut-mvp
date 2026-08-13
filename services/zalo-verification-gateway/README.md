# Zalo Verification Gateway

Gateway xác minh danh tính Zalo chạy trên một VPS có IP Việt Nam. Service chỉ xác minh token với Zalo, không chứa dữ liệu salon, khách, hàng chờ, điểm, ảnh hay quà.

## Local

Yêu cầu Node.js 22.

```bash
npm ci
npm run check
npm run benchmark
```

Tạo file môi trường từ `.env.example` và thay khóa mẫu bằng khóa ngẫu nhiên tối thiểu 32 byte. Không commit file môi trường thật.

## API

- `GET /health`: kiểm tra tiến trình cục bộ, không gọi Zalo.
- `POST /v1/zalo/verify`: chỉ nhận request đã ký HMAC từ Firebase Functions.

Canonical request:

```text
METHOD
PATH
TIMESTAMP
NONCE
REQUEST_ID
BODY_SHA256
```

Kết quả chỉ gồm `zaloUserId`, `requestId` và mã lỗi chuẩn hóa. Token, proof, chữ ký và lỗi thô từ Zalo không được ghi log hoặc trả về client.

Chi tiết bảo mật, triển khai, rotation và rollback: [ZALO_GATEWAY_PRE_VPS.md](../../docs/ZALO_GATEWAY_PRE_VPS.md).
