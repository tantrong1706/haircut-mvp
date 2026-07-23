# Checklist quyền riêng tư

HAIRCUT có thể xử lý tên hiển thị Zalo, số điện thoại khi người dùng đồng ý, lịch sử cắt tóc, điểm, mã quà, ghi chú và ảnh kiểu tóc. Mọi môi trường phải áp dụng nguyên tắc tối thiểu dữ liệu và tách tenant theo salon.

## Đồng ý và minh bạch

- Consent lưu ảnh mặc định là tắt.
- Giải thích mục đích trước khi xin số điện thoại hoặc chụp ảnh.
- Khách có thể tiếp tục dùng luồng cơ bản khi không đồng ý lưu ảnh.
- Hiển thị liên kết `/privacy`, `/terms` và kênh hỗ trợ công khai.
- Không tuyên bố tự động lấy số điện thoại Zalo nếu chưa có quyền/API được Zalo phê duyệt.

## Quyền truy cập

- Nhân viên chỉ thấy thông tin tối thiểu của khách đang phục vụ trong chi nhánh được phân công.
- Chủ salon có thể quản lý khách trong salon nhưng không truy cập salon khác.
- Quản trị hệ thống chỉ dùng vai trò `system_admin` và mọi thao tác nhạy cảm phải có audit.
- Client không được tự thay đổi điểm, phần thưởng, vai trò hoặc trạng thái deletion job.

## Ảnh và Storage

- Chỉ owner/staff đúng salon được chụp sau khi khách đồng ý.
- Tệp phải đúng MIME/kích thước và đường dẫn salon/customer được backend/rules cho phép.
- Không chấp nhận URL ảnh ngoài allowlist hoặc đưa URL ảnh vào telemetry.
- Khi khách rút consent hoặc yêu cầu xóa, deletion job phải xử lý cả Firestore lẫn Storage và retry idempotent.

## Xóa dữ liệu

- Khách có thể gửi yêu cầu trong ứng dụng hoặc qua webhook rút đồng ý của Zalo.
- Yêu cầu được ghi thành job, có trạng thái, thời hạn xử lý và audit.
- Chỉ đánh dấu hoàn tất khi không còn dữ liệu thuộc phạm vi xóa; lỗi một phần phải được retry.
- Yêu cầu xóa salon có thời gian chờ 14 ngày và có thể hủy trong thời hạn được phép.

## Telemetry

Không log hoặc gửi Analytics/Sentry: token, QR token, số điện thoại, email, Zalo ID, tên khách, ghi chú, mã quà đầy đủ, URL ảnh và payload webhook. Chỉ dùng mã lỗi ổn định, request ID và định danh vận hành đã làm sạch.

## Kiểm tra trước production

- Firestore/Storage Rules test đủ actor, role, tenant, branch, trạng thái inactive/suspended và consent ảnh.
- App Check được rollout có quan sát trước khi enforce.
- `/privacy` và `/terms` mở công khai trên thiết bị thật.
- Webhook quyền riêng tư dùng chữ ký hợp lệ, chống gửi lặp và không log secret.
- Diễn tập một yêu cầu xóa trên staging, bao gồm retry sau lỗi Storage.
