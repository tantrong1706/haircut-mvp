# Đóng góp

1. Tạo nhánh từ `main`.
2. Không commit `.env`, token Zalo, Firebase service account hoặc Sentry auth token.
3. Chạy `npm run check` trong `zalo-mini-app` và `firebase/functions`.
4. Với thay đổi Rules, chạy thêm Firebase Emulator tests.
5. Mở Pull Request, mô tả hành vi trước/sau và cách đã kiểm tra.

Mọi nghiệp vụ thay đổi điểm, phiên cắt, nhân viên, QR và quà phải đi qua Cloud Functions. Không thêm fallback ghi trực tiếp trong production.
