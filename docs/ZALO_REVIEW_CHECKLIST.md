# Checklist xét duyệt Zalo Mini App - CH Haircut Salon

Không tải Version 8 hoặc gửi xét duyệt khi còn mục bắt buộc `[ ]`.

## 1. Metadata

- [x] Tên Mini App: `CH Haircut Salon`.
- [x] Mini App ID trong production: `2038116772828167300`.
- [ ] Logo trên Portal khớp thương hiệu và hiển thị rõ ở kích thước nhỏ.
- [ ] Danh mục dịch vụ khớp chăm sóc khách hàng cho salon tóc.
- [ ] Mô tả ngắn và mô tả chi tiết khớp chức năng thực tế.
- [ ] Nội dung cập nhật không dùng câu mơ hồ như `QR test`.
- [ ] Support email và số điện thoại trên Portal còn hoạt động.

## 2. Quyền Zalo

- [x] Frontend dùng `getAccessToken` để định danh và xác minh ở backend.
- [x] Frontend chỉ bật popup `getUserInfo` sau khi khách thấy giải thích và bấm cho phép.
- [x] Frontend không gọi `getPhoneNumber`.
- [x] Frontend không gọi `scanQRCode`, location, notification, OA follow hoặc API chia sẻ.
- [ ] Trên Portal chỉ yêu cầu quyền hồ sơ Zalo thật sự cần.
- [ ] Gỡ yêu cầu **Mở tính năng quét QR Code** nếu đang được chọn.
- [ ] Gỡ yêu cầu số điện thoại nếu đang được chọn.
- [ ] Ảnh minh họa quyền cho thấy đúng màn giải thích và popup Zalo.

## 3. Privacy, Terms và xóa dữ liệu

- [x] Có route công khai `/privacy`.
- [x] Có route công khai `/terms`.
- [x] Privacy nói rõ avatar Zalo chỉ hiển thị tạm và số điện thoại chỉ do khách tự nhập.
- [x] Terms liên kết Privacy và hướng dẫn quyền dữ liệu.
- [x] Source có webhook rút lại đồng ý/xóa dữ liệu và test liên quan.
- [ ] Xác minh URL Privacy mở được trong Zalo trên Android/iPhone.
- [ ] Xác minh URL Terms mở được trong Zalo trên Android/iPhone.
- [ ] Xác minh Webhook URL trên Portal là endpoint HTTPS Function thật, không phải trang chủ Hosting.

URL dự kiến:

- Privacy: `https://haircut-c7d12.web.app/privacy`
- Terms: `https://haircut-c7d12.web.app/terms`
- Webhook: `https://asia-southeast1-haircut-c7d12.cloudfunctions.net/zaloPrivacyWebhook`

## 4. QR và reviewer flow

- [x] Link chung không QR không crash và không hiện owner/staff trong runtime Zalo.
- [x] Link chung giải thích rằng khách cần QR salon/chi nhánh.
- [x] QR salon hỗ trợ chọn chi nhánh; QR chi nhánh mở đúng chi nhánh theo code/test hiện có.
- [x] Reviewer flow chỉ chấp nhận QR salon/chi nhánh có chữ ký và phiên bản; không dùng QR gương cũ.
- [ ] Tạo QR salon testing còn hiệu lực.
- [ ] Tạo QR chi nhánh testing còn hiệu lực.
- [ ] Tạo deeplink testing còn hiệu lực.
- [ ] Không đưa `qrToken` vào Git, ảnh công khai, log, Analytics hoặc Sentry.
- [ ] QR/deeplink reviewer không chứa `mirrorId` hoặc `qrToken` thô.
- [ ] Đính kèm QR/deeplink thật trong hồ sơ reviewer.
- [ ] Ghi rõ tên salon demo, chi nhánh demo và kết quả cần thấy.
- [ ] Chuẩn bị dữ liệu demo không chứa thông tin khách thật.

## 5. Android và iPhone thật

- [ ] Android: mở link chung không QR.
- [ ] Android: quét QR salon và QR chi nhánh.
- [ ] Android: cho phép và từ chối hồ sơ Zalo.
- [ ] Android: check-in, đóng/mở lại Mini App và thử mạng yếu.
- [ ] iPhone: mở link chung không QR.
- [ ] iPhone: quét QR salon và QR chi nhánh.
- [ ] iPhone: cho phép và từ chối hồ sơ Zalo.
- [ ] iPhone: check-in, đóng/mở lại Mini App và thử mạng yếu.
- [ ] Không có nút bị che bởi menu Zalo hoặc safe area.
- [ ] Có trạng thái tải/lỗi/thử lại rõ ràng.

## 6. Tài khoản kiểm thử

- [ ] Tài khoản Developer/Admin hoàn tất reviewer flow.
- [ ] Tài khoản Zalo thường không thuộc nhóm Developer/Admin hoàn tất reviewer flow.
- [ ] Tài khoản Zalo thường không gặp màn “ứng dụng đang trong giai đoạn phát triển”.
- [ ] Không yêu cầu reviewer đăng nhập owner/staff trong customer Mini App.

## 7. Build và artifact

- [x] Production không bật `VITE_ZALO_PREVIEW`.
- [x] `build:zmp` dùng thư mục `www`.
- [x] `app-config.json` tham chiếu asset tồn tại.
- [x] Bundle không có endpoint localhost/HTTP do HAIRCUT sở hữu.
- [x] Bundle không có secret pattern hoặc nội dung `QR test`.
- [x] Bundle khách không có link tải HAIRCUT Manager.
- [x] Không có asset đơn vượt 500 KB.
- [ ] CI xanh trên đúng commit chuẩn bị upload Version 8.
- [ ] Lưu commit SHA và checksum artifact được upload.

Lệnh kiểm tra:

```powershell
cd C:\tantrong\haircut-mvp\zalo-mini-app
npm ci
npm run check
```

## 8. Ảnh cần đính kèm

- [ ] Link chung không QR.
- [ ] QR salon và màn chọn chi nhánh.
- [ ] QR chi nhánh và thông tin địa chỉ.
- [ ] Màn giải thích quyền hồ sơ.
- [ ] Popup quyền Zalo.
- [ ] Màn xác nhận tạo lượt.
- [ ] Trạng thái đang chờ/đang phục vụ.
- [ ] Điểm, lịch sử, vòng quay và kết quả quay.
- [ ] Mã quà chưa dùng/đã dùng.
- [ ] Privacy và Terms.

## 9. Quyết định gửi

- [ ] Đã đọc nguyên văn lý do từ chối Version 7 hoặc ghi rõ Zalo chưa cung cấp lý do.
- [ ] Mọi mục thủ công bắt buộc bên trên đã hoàn thành.
- [ ] Có người thứ hai review độc lập hồ sơ và artifact.
- [ ] Chỉ sau đó mới tải Version 8 và gửi xét duyệt.
