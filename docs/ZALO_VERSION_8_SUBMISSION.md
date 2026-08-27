# Nội dung chuẩn bị gửi Zalo Mini App Version 20

> Tên file được giữ lại để tương thích với readiness checker hiện hành. Nội dung bên dưới áp dụng cho Testing Version 20.

Tài liệu này dùng để điền Zalo Developer Portal. Không commit deeplink, QR token, mật khẩu hoặc dữ liệu khách thật.

## 1. Thông tin phiên bản

**Tên phiên bản**

```text
CH Haircut Salon - Check-in và tích điểm tại salon
```

**Nội dung cập nhật**

```text
CH Haircut Salon - Check-in và tích điểm tại salon

- Khách mở Mini App từ QR salon hoặc QR chi nhánh có chữ ký.
- Xác nhận thông tin Zalo để salon nhận diện đúng khách.
- Chọn chi nhánh, vào hàng chờ và theo dõi trạng thái phục vụ.
- Xem điểm, lịch sử cắt tóc, vòng quay và mã quà.
- Hoàn thiện quyền riêng tư, điều khoản và xử lý lỗi quyền/mạng rõ ràng.
```

## 2. Mô tả ứng dụng

```text
CH Haircut Salon là Zalo Mini App chăm sóc khách hàng tại salon tóc. Khách quét QR chung của salon để chọn chi
nhánh hoặc quét QR riêng của chi nhánh để check-in trực tiếp. Sau khi xác nhận hồ sơ Zalo, khách có thể tạo lượt
chờ, theo dõi trạng thái phục vụ, xem điểm, lịch sử cắt tóc, quay thưởng và quản lý mã quà.

Khách không cần tạo tài khoản hoặc mật khẩu riêng. Số điện thoại là thông tin tùy chọn do khách tự nhập. Chủ salon
và nhân viên sử dụng HAIRCUT Manager riêng; Mini App khách không chứa màn hình đăng nhập owner hoặc staff.
```

## 3. Dữ liệu reviewer

Vietnam gateway và bản Zalo Testing cuối đã hoạt động. Dữ liệu review hiện hành:

```text
Salon demo: CH Haircut Salon - Xét duyệt Zalo
Chi nhánh demo: Chi nhánh Trung tâm
Testing version: 20
QR testing: https://app.chhaircutsalon.cc/review-salon-v20.png
```

QR được tạo từ backend production, dùng chữ ký và phiên bản xoay. URL công khai chỉ chứa ảnh QR của salon review
với dữ liệu giả; source, Git và tài liệu không chứa deeplink hoặc token thô. Không dùng QR gương cũ hay `mirrorId`.

## 4. Hướng dẫn reviewer kiểm thử

```text
1. Mở QR salon hoặc QR chi nhánh được cung cấp.
2. Xác nhận thông tin Zalo khi Mini App hiển thị màn giải thích quyền.
3. Chọn chi nhánh nếu mở từ QR salon; QR chi nhánh bỏ qua bước chọn.
4. Bấm "Xác nhận vào hàng chờ" để check-in.
5. Kiểm tra trạng thái Waiting trên Mini App khách.
6. Nhân viên mở HAIRCUT Manager và nhận khách.
7. Kiểm tra trạng thái Serving trên Mini App khách.
8. Nhân viên tin cậy bấm "Hoàn tất & cộng điểm"; ghi chú là tùy chọn.
9. Nếu tài khoản không có quyền trực tiếp hoặc đạt hạn mức ngày, owner duyệt yêu cầu fallback.
10. Kiểm tra lượt chuyển sang Completed và không cộng trùng khi bấm/gửi lại.
11. Kiểm tra số điểm của khách đã được cập nhật.
12. Mở Lịch sử để xem lượt cắt vừa hoàn tất.
13. Mở Vòng quay và thực hiện quay khi đủ điểm.
14. Nếu trúng quà, mở Quà để xem mã quà và trạng thái sử dụng.
```

**Kết quả mong đợi**

- Khách không cần tài khoản hoặc mật khẩu riêng.
- Mini App khách không hiển thị owner, staff hoặc admin.
- Khách vẫn check-in được khi không nhập số điện thoại.
- Từ chối quyền hồ sơ không làm ứng dụng crash; có giải thích và nút thử lại phù hợp.
- Mỗi khách chỉ có một lượt đang mở trong cùng salon.
- Owner/staff đăng nhập và vận hành trên HAIRCUT Manager riêng.

## 5. Giải thích quyền Zalo

**Access token và hồ sơ cơ bản**

```text
CH Haircut Salon dùng getAccessToken để gửi access token mới tới Firebase Cloud Function qua HTTPS. Backend xác
minh danh tính bằng Zalo API. Mini App chỉ gọi getUserInfo sau khi khách xem giải thích và chủ động bấm cho phép.
Token không được lưu dài hạn, hiển thị hoặc ghi vào log, Analytics hay Sentry.
```

**Các quyền không dùng**

```text
Version 20 không gọi getPhoneNumber, scanQRCode, location, notification, followOA hoặc share. Khách quét QR bằng
camera/Zalo trước khi Mini App mở. Số điện thoại là tùy chọn và chỉ được lưu khi khách tự nhập.
```

Quyền trên Portal phải được chủ tài khoản đối chiếu thủ công với source trước khi gửi.

## 6. Quyền riêng tư, điều khoản và hỗ trợ

```text
Privacy Policy: https://app.chhaircutsalon.cc/privacy
Terms of Use: https://app.chhaircutsalon.cc/terms
Support email: tantrong1706@gmail.com
Support phone: 0838098761
Webhook: https://asia-southeast1-haircut-c7d12.cloudfunctions.net/zaloPrivacyWebhook
```

Source hiện hành mô tả mục đích xử lý dữ liệu, hồ sơ Zalo, số điện thoại tùy chọn, đồng ý lưu ảnh, thời gian lưu,
yêu cầu xóa dữ liệu và kênh hỗ trợ. URL live và webhook phải được kiểm tra thủ công trước khi gửi.

## 7. Ảnh minh họa

Dùng danh sách và trạng thái trong `docs/ZALO_REVIEW_CHECKLIST.md`. Ảnh phải chụp thật trong Zalo trên Android
và iPhone. Không dùng ảnh web giả làm bằng chứng thiết bị.

## 8. Điều kiện trước khi gửi Version 20

- [x] Vietnam gateway hoạt động, HTTPS health đạt và Firebase callable được cấu hình gateway.
- [x] Điền dữ liệu Testing thật mà không commit token QR.
- [x] Chuẩn bị salon/chi nhánh/dữ liệu reviewer theo spec, không dùng dữ liệu khách thật.
- [ ] Xác minh QR/deeplink bằng tài khoản Zalo thường ngoài nhóm Developer/Admin.
- [x] Đối chiếu quyền Portal với source; không yêu cầu quyền SDK bổ sung không dùng.
- [ ] Xác minh Privacy, Terms và webhook trên thiết bị thật.
- [ ] Chụp đủ ảnh Android/iPhone theo checklist.
- [x] Chạy build, unit, E2E, secret scan và GitHub CI trên đúng branch candidate.
- [ ] Có review độc lập.
- [ ] Chủ tài khoản mới thực hiện deploy Testing và gửi xét duyệt sau khi toàn bộ mục đạt.
