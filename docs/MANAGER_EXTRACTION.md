# Ranh giới HAIRCUT Manager

## Đã tách trong PR #14

- Manager đọc biến môi trường từ `apps/manager-mobile/.env*`; không còn dùng `envDir` của Zalo Mini App.
- Firebase bootstrap và callable dành cho native nằm tại `apps/manager-mobile/src/services/firebase.ts`.
- Cấu hình thiếu hoặc sai project trả mã lỗi an toàn, không hiển thị giá trị cấu hình.
- Android/iOS dùng cùng Application ID `vn.haircut.manager`; file Firebase native và signing không nằm trong Git.

## Phụ thuộc dùng chung tạm thời

Manager vẫn tái sử dụng `AuthGate`, `OwnerPage`, `StaffPage`, một lớp monitoring và CSS từ
`zalo-mini-app/src`. Đây là ranh giới tạm thời để tránh copy hàng nghìn dòng UI trong PR an toàn
production. Manager không dùng SDK Zalo trong luồng owner/staff và không đọc biến môi trường Zalo.

## Hướng tách tiếp theo

Di chuyển lần lượt auth, quyền, owner/staff features và UI dùng chung sang `packages/` với API rõ
ràng; mỗi lát cắt phải giữ test hiện tại. Không copy nguyên page hoặc tạo hai nguồn nghiệp vụ khác
nhau. Khi không còn import source từ `zalo-mini-app`, bỏ bước cài dependency frontend dùng chung
trong CI.
