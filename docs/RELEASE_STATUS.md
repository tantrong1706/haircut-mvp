# Trạng thái CH Hair Web

## Bản giao diện đang chờ duyệt — 29/09/2026

Giao diện Web barber tối đã được sửa lại theo phản hồi chủ dự án trên `codex/web-primary`.
Build production PASS, browser 45 PASS / 3 screenshot lịch sử skipped, kiểm tra 12 bố cục
và 16 lượt mở tab quản lý không còn tràn ngang hoặc lỗi accessibility nghiêm trọng.
Chưa deploy bản giao diện này; production bên dưới vẫn là bản cũ. Không triển khai Functions.
Xem [bằng chứng và giới hạn coverage](testing/web-barber.tdd.md); không coi đây là toàn bộ
production đã được kiểm toán lại.

Cập nhật định hướng: 28/09/2026. Sản phẩm hiện tại là Web app tại
<https://app.chhaircutsalon.cc>. Theo yêu cầu chủ dự án, công việc Zalo được lưu trên nhánh riêng
và không còn thuộc roadmap này.

## Nhánh

- `codex/web-primary`: phát triển Web, bắt đầu từ release `06e7e1a6fb18e66dc59f9b28497f5ab7eca05905`.
- `codex/zalo-archive`: Zalo Version 24, mốc `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`.
- `release/web-customer-platform-20260921`: giữ nguyên lịch sử release Web đã triển khai.
- Main chưa được merge. Không coi việc lưu branch là thao tác phát hành hay rollback production.

## Bằng chứng đã có

- Phone OTP thật và khôi phục tài khoản khi mở lại cùng browser: PASS.
- Signed branch QR, staff confirmation, điểm tăng đúng một lần, history và cooldown riêng: PASS.
- Người dùng đã xác nhận nút yêu cầu được ẩn trong cooldown; test xác nhận không hiển thị đếm ngược.
- Ba UID quét cùng một QR: ba hồ sơ/yêu cầu riêng, retry không trùng; emulator 78/78 PASS.
- CI nền tại `06e7e1a`: [8/8 job PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/36360226421).
- Web hiện có 216 unit tests; backend 108 unit; Rules 22; browser 42 executed tests và 3 intentional
  screenshot skips. Kiểm thử bổ sung cho nhánh Web-only phải được báo riêng theo commit mới.

## Deployment được ghi nhận gần nhất

- Hosting version: `sites/haircut-c7d12/versions/1b6aeb3b68649a48`.
- Hosting source: `cf22618273bf923964bf308c418446c2fc8ab967`.
- Sáu callable web và chín hàm dùng chung đã được triển khai ở lượt Web trước.
- Lượt tách nhánh không tự xóa endpoint/secret/Gateway đang chạy.
- Các lần deploy tiếp theo phải ghi nhận theo bằng chứng thực tế trong
  [Web release readiness](WEB_CUSTOMER_RELEASE_READINESS.md).

## Phạm vi đang dùng

Khách dùng Web Phone Auth. Nhân viên và chủ salon dùng `/staff`, `/owner`.
QR chọn sẵn chi nhánh; khách gửi yêu cầu, nhân viên xác nhận; cooldown hai giờ theo khách/salon.
Web mở từ trình duyệt tích hợp vẫn phải giữ luồng Web, không chuyển sang xác thực Mini App.

CI của nhánh Web tập trung Customer Web, backend/Rules, Manager Web, Admin, browser và secret checks.
Build native và xét duyệt Mini App không thuộc lượt công việc này.

## Giới hạn cần ghi đúng

App Check chưa enforcement và frontend provider hiện chưa được bật lại sau lỗi attestation/throttle.
Các dependency advisories đã ghi trong báo cáo readiness vẫn cần xử lý theo phạm vi riêng; không
tự nâng major dependency. Kết quả test automation không thay thế việc kiểm tra thiết bị thật.

Hồ sơ review Zalo trong cây source là lịch sử. Version 24 bị từ chối theo thông tin chủ dự án; trạng
thái đó không chặn Web và không dẫn tới nhiệm vụ gửi lại Zalo.
