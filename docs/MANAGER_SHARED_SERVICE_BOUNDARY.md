# Ranh giới service của HAIRCUT Manager

HAIRCUT Manager chỉ nhập API nghiệp vụ qua `apps/manager-mobile/src/services/managerApi.ts`
và monitoring qua `apps/manager-mobile/src/services/monitoring.ts`.

Các adapter trong `apps/manager-mobile/src/services/adapters/` là ranh giới tạm thời với phần
service dùng chung đang nằm trong `zalo-mini-app`. Manager không nhập page, CSS, ZMP SDK hoặc
biến môi trường Zalo.

## Quy tắc

- Không nhập trực tiếp service Zalo từ component, feature, hook hoặc native runtime của Manager.
- Không sao chép business logic chỉ để bỏ đường dẫn import.
- Khi tách package dùng chung, chuyển lần lượt contract trung lập sang `packages/`; giữ API adapter
  ổn định để tránh sửa hàng loạt màn hình.
- Firebase và App Check của Manager luôn dùng cấu hình trong `apps/manager-mobile/.env*`.
- Các API lịch sử còn thiếu phải được bổ sung ở PR backend riêng trước khi nối vào giao diện.

## Hướng tách tiếp

1. Chuyển auth contract và Firebase client trung lập sang `packages/firebase-client`.
2. Chuyển operations contract sang `packages/manager-domain`.
3. Giữ xử lý Zalo profile/token trong `zalo-mini-app`.
4. Xóa từng adapter tạm thời chỉ sau khi Manager có package thay thế và test tương đương.
