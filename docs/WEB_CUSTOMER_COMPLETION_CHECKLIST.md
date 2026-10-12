# CH Hair Web — checklist phát hành

Phạm vi hiện tại: Web trên Firebase; không Zalo Mini App, Botkeep hoặc bản native.
Xem [trạng thái phát hành](RELEASE_STATUS.md) để phân biệt source đã kiểm thử với website live.

## Luồng và ranh giới được kiểm thử

- [x] Phone OTP và nhớ phiên cùng trình duyệt; không tự tạo danh tính từ cache cũ.
- [x] QR được backend xác minh; QR quyết định đúng chi nhánh, không thêm bước chọn lại.
- [x] Khách gửi yêu cầu điểm; nhân viên xác nhận; chống gửi trùng và giữ cooldown hai giờ ngầm.
- [x] Khách xem điểm, lịch sử/ảnh, vòng quay và quà; giữ ranh giới UID/salon trên backend.
- [x] Bản vá tháng 10 chặn callback dữ liệu cũ sau khi dừng đồng bộ, đổi UID, đăng xuất hoặc rời màn check-in.
- [x] Vòng quay không trả kết quả về màn đã rời; timer animation được dọn khi unmount.
- [x] Desktop Chromium, mobile Chromium và mobile WebKit: 57/57 E2E PASS ngày 12/10/2026.
- [x] Web: 209/209 unit tests, lint, format, TypeScript và production build PASS.
- [x] Script Hosting dừng khi build/đóng gói lỗi; không tự deploy Functions.
- [x] gRPC đã vá, đọc/ghi/transaction/listener/authorization qua emulator PASS; Firebase SDK không đổi.
- [x] CSP baseline enforce; chặn base ngoài origin/plugin object, không mới chặn script/network OTP.

## Gate trước và sau deploy

- [x] CI của đúng commit ứng viên PASS; không dùng kết quả của commit cũ.
- [x] Lưu Hosting version đang chạy và bản đóng gói trước deploy để rollback.
- [x] Chỉ deploy Hosting sau quyền cho phép của chủ dự án.
- [x] HTML live khớp bundle mới; asset, route khách và trang đăng nhập quản lý tải được.
- [x] Ghi rõ console/network lỗi quan sát được; không gọi HTTP 200 là bằng chứng đăng nhập thật.

Chủ dự án đã cho phép main + Hosting khi kiểm thử/CI PASS cho bản vá phiên và đợt gRPC/CSP.
Trạng thái từng gate sau thực thi được ghi tại `RELEASE_STATUS.md`, không suy ra từ checklist này.

## Giới hạn cần giữ đúng

- OTP thật/giữ đăng nhập/nhân viên cộng điểm đã có bằng chứng vận hành trước đây, không phải mọi lần release đều đã test lại bằng điện thoại thật.
- App Check vẫn giữ policy hiện có; không tự bật enforcement hoặc hạ ngưỡng để ép kiểm thử PASS.
- Customer Web production dependency audit hiện 0 cảnh báo; override gRPC là tạm thời và không chứng minh mọi workspace an toàn tuyệt đối.
- Lượt WebKit live đầu có lỗi network Firebase; lượt chờ mạng ổn định không tái hiện. Telemetry cancel vẫn được ghi rõ trong release status, không tuyên bố zero-network-error.
- Test tự động dùng dữ liệu fixture/emulator. Không tạo lượt điểm, gửi OTP hoặc đổi quà thật chỉ để kiểm tra giao diện.
