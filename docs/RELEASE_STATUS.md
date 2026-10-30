# Trạng thái CH Hair Web

Cập nhật 22/10/2026 (Asia/Saigon). Sản phẩm là Web trên Firebase tại
https://app.chhaircutsalon.cc. Source trên GitHub và bản đang phục vụ được ghi riêng bên dưới.

## Production — bằng chứng gần nhất được ghi tại đây (22/10)

Thông tin bên dưới là biên bản phát hành ngày 22/10, không phải đối chiếu live ngày 30/10.
Source mới hoặc CI PASS không tự chứng minh production đã nhận bản đó.

- Source đã deploy: 5435256bec2be8284215836c7a4c56aa4ff3e32b, merge PR #74.
- Hosting version: abd70bd7cb0765fe (site haircut-c7d12).
- 11 API Web/ảnh/khách quen đã phát hành và xác minh ACTIVE, runtime Node.js 22.
- Storage Rules mới đã phát hành và đối chiếu trùng source.
- Không deploy Admin, Zalo, Firestore Rules hoặc indexes. App Check enforcement không đổi.
- Bản sao lưu 9 Functions cũ, cấu hình và Rules được giữ ngoài repository ở nơi hạn chế quyền.
  Hosting trước đợt này: eab0acb4bfd1081a. Không commit các bản sao lưu có cấu hình riêng.

Các API được phát hành:

resolveCustomerQr, getWebCustomerContext, checkInWebCustomer, getHaircutPhotoReadUrls,
beginHaircutPhotoUpload, finalizeHaircutPhotoUpload, awardReturningCustomerPoints,
updatePendingPointRequestPhotos, getWebCustomerHistory, searchSalonCustomers,
getSalonCustomerDetails.

## Bằng chứng của lần phát hành 22/10

- CI của merge SHA: Build Web và CodeQL PASS.
- Chạy lại local: 119/119 backend unit; 256/256 Web tests, lint/format/build PASS.
- Domain chính trả HTTPS 200 và HTML trùng artifact trên /, /owner, /staff, /history, /wheel.
- Hai API mới từ chối request chưa đăng nhập bằng 401 UNAUTHENTICATED.
- Kiểm tra live bằng salon/tài khoản/khách giả: danh bạ, tổng số khách, tìm trùng 4 số cuối,
  lưu ghi chú, upload JPEG 2×2, finalize, xem link ký, chặn đọc trực tiếp và thu hồi token dài hạn PASS.
- Consent thu hồi chặn URL ảnh mới; note-only không trả URL ảnh. Ảnh và ghi chú có trong lịch sử
  sau xác nhận; cộng đúng một điểm. Gửi lặp/cooldown không cộng thêm.
- Chủ salon và Nhân viên đóng/mở lại browser profile riêng vẫn giữ đăng nhập.
- Giao diện bản thật kiểm tra ở viewport 360px và 1440px: không tràn ngang; không ghi nhận
  page error hoặc HTTP error trong phiên thử đó.
- Ba request mở cùng QR chi nhánh giả đồng thời PASS; QR sai bị từ chối.
- Toàn bộ dữ liệu/tài khoản/ảnh giả và browser profile đã dọn, không đụng dữ liệu khách thật.

Lần chuẩn bị canary đầu thất bại do công cụ thử thiếu quota-project header khi dùng OAuth;
dữ liệu giả của lần đó cũng đã dọn. Không thay quyền Auth hay cấu hình app để ép PASS.

## Source cleanup sau phát hành — chưa deploy

Bản dọn tên và tài liệu Web đổi hằng branding APP_NAME/APP_MARK, script start-web, gỡ meta/CSS/
nhánh thông báo Zalo thừa và cập nhật hướng dẫn. Chủ dự án chỉ cho phép nhập main khi CI PASS,
không cho deploy trong đợt dọn này. Website hiện vẫn chạy source PR #74 ở trên.

Đổi source không xóa Functions/secrets/Gateway đã triển khai và không đổi ID khách.
Xem [ranh giới tương thích](LEGACY_COMPATIBILITY.md) và [bằng chứng dọn tên](testing/web-naming-cleanup.tdd.md).

## Giới hạn

- Bản chuẩn bị `codex/privacy-readiness` ngày 30/10 chưa được merge/deploy. Không thay số liệu
  phát hành 22/10 bằng kết quả local; xem [checklist quyền riêng tư](PRIVACY_CHECKLIST.md).

- Browser viewport không thay thế kiểm thử iPhone/Android vật lý. Không gửi OTP thật trong
  canary 22/10; bằng chứng OTP thực trước đây nằm trong WEB_CUSTOMER_RELEASE_READINESS.md.
- Ảnh/ghi chú chỉ lưu trước xác nhận điểm. Tích điểm nhanh không đính kèm ảnh/ghi chú.
- Không thu hồi hàng loạt link ảnh khách cũ; link ký tối đa 15 phút không thu hồi bản đã tải về.
- Storage Rules compile/deploy thành công, còn cảnh báo helper cũ không được gọi.
- Đây là bằng chứng của release cụ thể, không cam kết ứng dụng không còn lỗi hoặc bảo mật tuyệt đối.
- Các báo cáo audit và số lượng cảnh báo dependency cũ có ngày riêng; không xem là kết quả hiện tại.

Báo cáo trước ngày 22/10 còn trong lịch sử Git; không xóa lịch sử release hoặc bản sao lưu.
