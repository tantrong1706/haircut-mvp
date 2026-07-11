# Xử lý sự cố

## Khách không check-in

Kiểm tra gương đang bật, QR token hiện tại, Zalo Mini App version và log `registerCustomerFromZalo`. Không mở Rules để xử lý tạm.

## Owner/staff báo không có quyền

Kiểm tra Firebase Auth UID và `users/{uid}` gồm đúng `salonId`, `role`, `isActive`. Không truyền salonId từ URL để né lỗi.

## Duyệt điểm không cập nhật

Kiểm tra log `approvePointRequest`, trạng thái `point_requests` và `chair_sessions`. Mỗi session chỉ có một request ID; không sửa điểm trực tiếp trong Firestore Console trừ khi đang xử lý sự cố có ghi biên bản.

## Zalo đứng ở splash

Chạy `npm run build:zmp` và `npm run validate:zmp`, xác nhận asset trong `app-config.json` tồn tại, deploy testing version mới rồi xóa cache Mini App trên thiết bị thử.

## Chi phí tăng bất thường

Kiểm tra Functions invocations, Firestore reads và Storage egress theo salon/thời gian. Tạm dừng QR bị lạm dụng, giữ Rules đóng và rà log trước khi thay đổi quota.
