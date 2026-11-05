# CH Hair Web — checklist phát hành

Phạm vi hiện tại: Web trên Firebase; không Zalo Mini App, Botkeep hoặc bản native.
Xem [trạng thái phát hành](RELEASE_STATUS.md) để phân biệt source đã kiểm thử với website live.

Đối chiếu: 05/11/2026 (Asia/Saigon). Customer Hosting `86906d689d90731c`, source giao diện
`8667226049f60f6d583adb00468e7b5bc4beb54f`. Checklist này không tự cho phép phát hành mới.

## Luồng đã triển khai và được kiểm thử tự động

- [x] Phone OTP và nhớ phiên cùng trình duyệt; không tự tạo danh tính từ cache cũ.
- [x] QR được backend xác minh; QR quyết định đúng chi nhánh, không thêm bước chọn lại.
- [x] Khách gửi yêu cầu điểm; nhân viên xác nhận; chống gửi trùng và giữ cooldown hai giờ ngầm.
- [x] Khách xem điểm, ngày cắt, vòng quay và quà; giữ ranh giới UID/salon trên backend.
- [x] Ảnh/ghi chú là nội bộ: chủ salon và thợ được phân công cùng chi nhánh xem; khách không thấy.
- [x] Chủ/thợ/khách đổi tên đúng quyền, không đổi SĐT, điểm hoặc lịch sử đã hoàn tất.
- [x] Lưu ảnh/ghi chú trước xác nhận và bổ sung lượt gần nhất theo điều kiện API, không cộng thêm điểm.
- [x] Nhãn ảnh rút gọn; vẫn cần khách tự chọn quyền ảnh, không thay giới hạn upload phía server.
- [x] Bảng quyền riêng tư chỉ mở khi bấm; hai liên kết nằm ở chân trang và không bị nav khách che.
- [x] Thống kê chưa đồng ý vẫn tắt; lựa chọn chỉ thiết yếu giữ nguyên Auth storage.
- [x] Bản vá tháng 10 chặn callback dữ liệu cũ sau khi dừng đồng bộ, đổi UID, đăng xuất hoặc rời màn check-in.
- [x] Vòng quay không trả kết quả về màn đã rời; timer animation được dọn khi unmount.
- [x] Desktop Chromium, mobile Chromium và mobile WebKit: 78/78 E2E PASS ngày 05/11/2026.
- [x] Web: 374/374 unit tests, lint, format, TypeScript và production build PASS.
- [x] Functions unit 119, Rules 35, integration 219, Admin 42, Manager 87 và repository 154 test PASS.
- [x] Nhóm privacy 39 test PASS; coverage 100% lines/statements/functions, 96.77% branches.
- [x] Script Hosting dừng khi build/đóng gói lỗi; không tự deploy Functions.
- [x] gRPC đã vá, đọc/ghi/transaction/listener/authorization qua emulator PASS; Firebase SDK không đổi.
- [x] CSP baseline enforce; chặn base ngoài origin/plugin object, không mới chặn script/network OTP.

## Gate trước và sau deploy

- [x] CI của đúng commit ứng viên PASS; không dùng kết quả của commit cũ.
- [x] Lưu Hosting version đang chạy và bản đóng gói trước deploy để rollback.
- [x] Chỉ deploy Hosting sau quyền cho phép của chủ dự án.
- [x] HTML live khớp bundle mới; asset, route khách và trang đăng nhập quản lý tải được.
- [x] Ghi rõ console/network lỗi quan sát được; không gọi HTTP 200 là bằng chứng đăng nhập thật.
- [x] Đợt #85 có đủ 9 PR checks PASS; merge-main Build Web/CodeQL PASS và full suite 19/19 PASS.
- [x] Hậu kiểm 12 route/11 entry assets; viewport 360px/1440px, footer và axe PASS, không lỗi trong phiên thử.
- [x] Hosting-only #85 giữ nguyên inventory/state/updateTime của 86 Functions.

Chủ dự án đã cho phép main + Hosting khi kiểm thử/CI PASS cho bản vá giao diện #85.
Trạng thái từng gate sau thực thi được ghi tại `RELEASE_STATUS.md`, không suy ra từ checklist này.

## Chưa được xác nhận lại bằng điện thoại vật lý cho release #85

- [ ] OTP thật lần đầu và đóng/mở lại đúng trình duyệt của khách trên điện thoại thật.
- [ ] Hồ sơ thử riêng: quét QR → quyền ảnh → yêu cầu điểm → thợ lưu ảnh/ghi chú → xác nhận đúng một điểm.
- [ ] Đọc lại lịch sử phía khách và nội bộ salon; kiểm tra không cộng lặp trong cooldown trên thiết bị thật.

Đây là phần bằng chứng vận hành còn thiếu, không phải khẳng định chức năng chưa được lập trình.
Cần safe test account/QR của chi nhánh do chủ dự án xác nhận; không đoán danh tính, tạo giả phiên
đăng nhập, gửi OTP hoặc sửa điểm khách thật để đánh dấu các mục này.

## Giới hạn cần giữ đúng

- OTP thật/giữ đăng nhập/nhân viên cộng điểm đã có bằng chứng vận hành trước đây, không phải mọi lần release đều đã test lại bằng điện thoại thật.
- App Check vẫn giữ policy hiện có; không tự bật enforcement hoặc hạ ngưỡng để ép kiểm thử PASS.
- Runtime dependency audit cả 4 workspace là 0 advisory ở lần kiểm tra 05/11; dev-tool advisories
  không được coi là đã hết. Override gRPC không chứng minh mọi thành phần an toàn tuyệt đối.
- Các biên bản trước đây có lỗi network riêng. Hậu kiểm anonymous #85 không ghi nhận lỗi trong
  phiên thử đó; không suy ra ứng dụng sẽ không bao giờ lỗi hoặc không cần hỗ trợ vận hành.
- Test tự động dùng dữ liệu fixture/emulator. Không tạo lượt điểm, gửi OTP hoặc đổi quà thật chỉ để kiểm tra giao diện.
