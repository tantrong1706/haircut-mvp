# Thiết Lập Đăng Nhập Chủ Salon/Nhân Viên

Trang khách vẫn đang chạy theo luồng test nội bộ. Riêng trang `/staff` và `/owner` đã yêu cầu Firebase Auth kèm hồ sơ phân quyền trong `users/{uid}`.

## Bật Firebase Auth

1. Mở Firebase Console.
2. Chọn project `haircut-c7d12`.
3. Vào Authentication > Sign-in method.
4. Bật đăng nhập email/mật khẩu.

## Tạo tài khoản chủ salon

1. Vào Authentication > Users.
2. Thêm user bằng email và mật khẩu của chủ salon.
3. Sao chép Firebase Auth UID vừa tạo.
4. Vào Firestore Database.
5. Tạo document `users/{uid}`:

```json
{
  "salonId": "demo-salon",
  "name": "Chủ salon",
  "role": "owner",
  "isActive": true
}
```

## Tạo tài khoản nhân viên

Tạo thêm một Firebase Auth user, sao chép UID rồi tạo `users/{uid}`:

```json
{
  "salonId": "demo-salon",
  "name": "Nhân viên",
  "role": "staff",
  "isActive": true
}
```

## Quyền truy cập

- `/owner?salonId=demo-salon`: chỉ chủ salon.
- `/staff?salonId=demo-salon`: chủ salon hoặc nhân viên.
- User có `isActive: false` sẽ bị chặn.

## Lưu ý về Firestore rules

`firebase/firestore.rules` trong repo hiện là rules production: client không được ghi trực tiếp các collection nghiệp vụ. Chỉ deploy rules này sau khi Cloud Functions đã deploy và web app đã chuyển sang `VITE_FUNCTION_WRITE_MODE=required`; nếu không, luồng khách/staff sẽ không fallback ghi Firestore trực tiếp được nữa.
