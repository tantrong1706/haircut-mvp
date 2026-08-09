# Nội dung chuẩn bị gửi Zalo Mini App Version 8

Tài liệu này dùng để điền Portal. Không commit deeplink, QR token, mật khẩu hoặc dữ liệu khách thật.

## 1. Thông tin phiên bản

**Tên phiên bản**

```text
HAIRCUT - Check-in và tích điểm tại salon
```

**Nội dung cập nhật**

```text
HAIRCUT – Check-in và tích điểm tại salon

Nội dung cập nhật:
- Khách mở HAIRCUT từ QR salon hoặc QR chi nhánh.
- Xác nhận thông tin Zalo để salon nhận diện đúng khách.
- Chọn chi nhánh và tạo lượt chờ.
- Theo dõi trạng thái phục vụ.
- Xem điểm, lịch sử, vòng quay và mã quà.
- Hoàn thiện quyền riêng tư, điều khoản và xử lý khi người dùng từ chối quyền.
```

## 2. Mô tả ứng dụng

```text
HAIRCUT là Zalo Mini App chăm sóc khách hàng tại salon tóc. Khách quét QR chung của salon để chọn
chi nhánh hoặc quét QR riêng của chi nhánh để check-in trực tiếp. Sau khi xác nhận tên Zalo, khách
có thể tạo lượt chờ, theo dõi trạng thái phục vụ, xem điểm, lịch sử cắt tóc, quay thưởng và quản lý
mã quà. Chủ salon và nhân viên vận hành bằng cổng quản lý web riêng, không nằm trong luồng khách
trên Zalo Mini App.
```

## 3. Hướng dẫn reviewer

Điền giá trị thật trước khi gửi:

```text
Salon demo: [TÊN_SALON_DEMO]
Chi nhánh demo: [TÊN_CHI_NHÁNH_DEMO]
Deeplink testing: [DEEPLINK_REVIEW_HỢP_LỆ]
QR testing: [QR_REVIEW_HỢP_LỆ]
```

Không thay placeholder bằng link tự đoán. QR/deeplink phải được tạo từ bản Testing và kiểm tra bằng
tài khoản Zalo thường ngay trước khi gửi. Chỉ dùng QR salon hoặc QR chi nhánh có chữ ký và phiên bản
do hệ thống quản lý QR tạo; không dùng QR gương cũ, tham số `mirrorId` hoặc `qrToken` thô.

**Các bước kiểm thử**

```text
1. Mở deeplink hoặc quét QR demo được cung cấp.
2. Nếu là QR salon có nhiều chi nhánh, chọn chi nhánh demo. QR chi nhánh sẽ mở trực tiếp đúng nơi.
3. Kiểm tra tên salon, tên chi nhánh và địa chỉ.
4. Bấm "Cho phép đọc tên Zalo" nếu Zalo chưa cấp quyền hồ sơ, sau đó xác nhận thông tin.
5. Bấm "Xác nhận vào hàng chờ".
6. Xem trạng thái lượt tại trang Điểm.
7. Sau khi salon demo xử lý lượt, kiểm tra điểm, lịch sử, vòng quay và mã quà.
8. Có thể mở link chung không QR để kiểm tra màn hướng dẫn an toàn; luồng check-in cần QR hợp lệ để
   xác định đúng salon.
```

**Kết quả mong đợi**

```text
- Không cần tài khoản hoặc mật khẩu riêng cho khách.
- Không hiển thị trang owner/staff trong Mini App khách.
- Khách vẫn dùng được nếu không cung cấp số điện thoại.
- Từ chối quyền hồ sơ không làm app crash; app giải thích và cho phép thử lại.
- Mỗi khách chỉ có một lượt mở trong cùng salon.
```

## 4. Giải thích quyền

**Định danh bằng access token**

```text
HAIRCUT dùng Zalo access token để backend xác minh đúng người dùng theo Authentication của Zalo.
Token chỉ được gửi đến Firebase Cloud Function qua HTTPS, không hiển thị, không lưu lâu dài và
không ghi vào log/Analytics/Sentry.
```

**Tên và ảnh đại diện Zalo**

```text
HAIRCUT xin quyền hồ sơ khi khách bấm nút có giải thích rõ. Tên giúp nhân viên nhận đúng khách.
Ảnh đại diện chỉ hiển thị tạm trên màn xác nhận, không được lưu trong hồ sơ salon.
```

**Không yêu cầu**

```text
Phiên bản này không gọi API lấy số điện thoại, quét QR bên trong Mini App, vị trí, notification,
theo dõi OA hoặc chia sẻ. Khách quét QR bằng camera/Zalo trước khi Mini App được mở. Số điện thoại
là tùy chọn và chỉ được lưu khi khách tự nhập.
```

## 5. URL công khai

```text
Privacy Policy: https://haircut-c7d12.web.app/privacy
Terms of Use: https://haircut-c7d12.web.app/terms
Support email: tantrong1706@gmail.com
Support phone: 0838098761
```

Webhook cần xác minh trên Portal:

```text
https://asia-southeast1-haircut-c7d12.cloudfunctions.net/zaloPrivacyWebhook
```

## 6. Ảnh đính kèm

1. Link chung không QR.
2. QR salon và chọn chi nhánh.
3. QR chi nhánh với tên/địa chỉ.
4. Màn giải thích quyền hồ sơ.
5. Popup quyền Zalo.
6. Xác nhận vào hàng chờ.
7. Trạng thái đang chờ và đang phục vụ.
8. Điểm và lịch sử.
9. Vòng quay trước/sau khi quay.
10. Mã quà chưa dùng/đã dùng.
11. Privacy và Terms.

Ảnh phải chụp thật trong Zalo trên Android và iPhone; ảnh web chỉ là tài liệu tham khảo.

## 7. Việc bắt buộc trước khi tải Version 8

- [ ] Điền bốn placeholder bằng dữ liệu testing thật, không commit token QR.
- [ ] Xác minh QR/deeplink bằng Zalo thường ngoài nhóm Developer/Admin.
- [ ] Gỡ quyền quét QR và số điện thoại trên Portal nếu đang được yêu cầu.
- [ ] Xác minh Privacy, Terms và Webhook URL mở/nhận request đúng.
- [ ] Chụp đủ ảnh Android/iPhone.
- [ ] Chạy `npm ci` và `npm run check`.
- [ ] CI xanh trên đúng commit.
- [ ] Có review độc lập.
- [ ] Chưa deploy hoặc upload từ Codex; chủ tài khoản thực hiện thủ công sau khi checklist đạt.
