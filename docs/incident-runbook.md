# Xử lý sự cố HAIRCUT

## Khách không check-in

1. Xác nhận salon và chi nhánh đang hoạt động.
2. Kiểm tra QR salon/chi nhánh có phải token hiện hành, chưa bị xoay và đúng App ID Zalo.
3. Kiểm tra phiên bản Zalo Mini App đang mở và log `registerCustomerFromZalo` theo `requestId`.
4. Kiểm tra lỗi xác minh Zalo, App Check, Functions và Firestore quota.

QR gương cũ chỉ là cơ chế tương thích migration. Không mở Rules hoặc tiết lộ token để xử lý tạm.

## Owner/staff báo không có quyền

Kiểm tra Firebase Auth UID và `users/{uid}` gồm `role`, `isActive`, `salonId`, `branchId/branchIds`. Tiếp theo kiểm tra salon/chi nhánh có bị khóa và phiên bản Manager có đạt `minimumVersion` hay không. Không sửa URL hoặc dữ liệu client để né kiểm tra quyền.

## Hai nhân viên cùng nhận một khách

Kiểm tra trạng thái `chair_sessions`, actor trong audit và log `claimServiceSession`. Giao dịch chỉ được phép có một người thành công; nếu có hai người, tạm dừng thao tác tại salon liên quan và rollback release gần nhất sau khi lưu bằng chứng đã làm sạch.

## Duyệt điểm không cập nhật

Kiểm tra `point_requests`, `chair_sessions`, `haircut_records` và audit bằng request ID. Không cộng điểm trực tiếp trong Firestore Console; chạy lại request idempotent hoặc dùng quy trình khôi phục có biên bản.

## Mã quà bị đổi hai lần

Khóa thao tác đổi quà của salon bị ảnh hưởng, đối chiếu reward, audit và request ID. Một mã chỉ có một lần chuyển sang `used`; không tự sửa trạng thái trước khi xác định race/replay hay tài khoản bị lộ.

## Zalo đứng ở splash hoặc báo đang phát triển

Xác nhận bản Testing/Production đã được phát hành cho đúng App ID và tài khoản thử có quyền truy cập. Chạy `npm run build:zmp` và `npm run validate:zmp`, kiểm tra asset trong `app-config.json`, sau đó xóa cache Mini App trên thiết bị thử.

## Push Manager không đến

Kiểm tra permission thiết bị, FCM token, APNs/Firebase native config và log trigger đã làm sạch. Xóa token không còn hợp lệ; không ghi token đầy đủ vào log hoặc ticket.

## Chi phí hoặc lỗi tăng bất thường

Kiểm tra Functions invocations, Firestore reads/writes, Storage egress và tỷ lệ lỗi theo salon/thời gian. Có thể khóa salon hoặc QR bị lạm dụng bằng luồng quản trị có audit; giữ Rules đóng và rà log trước khi thay đổi quota.

## Xóa dữ liệu bị lỗi

Kiểm tra `customer_deletion_jobs`/salon deletion job, trạng thái retry và residue. Không đánh dấu hoàn tất thủ công khi Firestore hoặc Storage còn dữ liệu; dùng worker idempotent và quy trình tại `docs/PRODUCTION_OPERATIONS.md`.
