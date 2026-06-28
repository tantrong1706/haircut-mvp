# Hướng Dẫn App Store

Dự án chưa sẵn sàng nộp App Store. Chỉ dùng checklist này sau khi web MVP ổn định.

## Điều kiện cần

- Máy Mac hoặc Mac cloud.
- Xcode.
- Apple ID.
- Tài khoản Apple Developer Program.
- Quyền truy cập App Store Connect.
- Firebase iOS config: `GoogleService-Info.plist`.
- App icon, ảnh chụp màn hình, URL hỗ trợ và URL chính sách quyền riêng tư.

Apple Developer Program là bắt buộc nếu muốn dùng TestFlight và phát hành App Store.

## Bundle ID đề xuất

```text
com.tantrong.haircut
```

Dùng cùng Bundle ID trong:

- Xcode target settings.
- Apple Developer Identifiers.
- Firebase iOS app config.

## Đăng nhập iOS

Bản iOS đầu tiên nên dành cho chủ salon/nhân viên.

Thứ tự đề xuất:

1. Email/mật khẩu cho chủ salon và nhân viên.
2. Thêm Sign in with Apple trước khi App Store nếu có đăng nhập bên thứ ba.
3. Đăng nhập Zalo để sau.

Khách vẫn nên dùng Zalo Mini App và không bị ép cài app iOS.

## Metadata App Store

Tên app:

```text
HAIRCUT
```

Subtitle:

```text
Chăm sóc khách hàng salon tóc
```

Danh mục:

```text
Business
```

Mô tả gợi ý:

```text
HAIRCUT giúp salon tóc lưu lịch sử cắt tóc, cộng điểm, quản lý nhân viên và giữ chân khách hàng bằng QR/Zalo.
```

## Trước khi nộp

- Có trang chính sách quyền riêng tư công khai.
- Có tài khoản test cho Apple review.
- Không dùng dữ liệu demo nhạy cảm.
- Không để Firestore rules mở.
- Không yêu cầu quyền không cần thiết.
- App không crash khi thiếu dữ liệu salon.
