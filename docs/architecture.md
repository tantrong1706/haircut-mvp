# Kiến trúc HAIRCUT

```text
Khách Zalo -> Callable Functions (xác minh Zalo) -> Firestore
Owner/Staff -> Firebase Auth -> Callable Functions -> Firestore
Owner/Staff -> Firestore listeners chỉ đọc dữ liệu đúng salon
Ảnh -> Firebase Storage Rules + hồ sơ quyền trong Firestore
```

Frontend dùng chung một React app nhưng tách bundle theo route. Owner/staff đăng nhập Firebase Auth; salonId lấy từ `users/{uid}`. Khách không đọc Firestore trực tiếp: check-in, trạng thái, lịch sử, quà và vòng quay đều qua Functions xác minh Zalo.

Cloud Functions là ranh giới ghi nghiệp vụ. Firestore Rules chỉ cho thành viên đang hoạt động đọc dữ liệu salon của mình và từ chối mọi business write từ client. Admin SDK trong Functions thực hiện transaction cho check-in, duyệt điểm và quay thưởng.

`app-config.json` được sinh từ `.vite/manifest.json`; entry Zalo luôn có đuôi `.module.js`. Service worker chỉ đăng ký trên web thông thường, không chạy trong Zalo Mini App.
