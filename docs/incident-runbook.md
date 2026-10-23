# Xử lý sự cố CH Hair Web

## Khách không mở được từ QR

1. Kiểm tra salon/chi nhánh còn hoạt động và QR chi nhánh là bản ký hiện hành.
2. Link phải mở https://app.chhaircutsalon.cc/checkin với đủ tham số. Không thêm môi trường Testing.
3. Kiểm tra resolveCustomerQr, getWebCustomerContext, checkInWebCustomer theo request ID;
   không chép QR signature hoặc thông tin khách đầy đủ vào ticket/log.
4. Kiểm tra Firebase Auth, Functions, quota và App Check hiện hành. Không tắt bảo vệ để thử.

Không tự tạo token hoặc cho chọn chi nhánh khác để vượt qua QR sai.

## Bị yêu cầu đăng nhập lại

Xác nhận đúng domain và cùng trình duyệt đã đăng nhập. Chrome, Safari, trình duyệt trong ứng dụng
và chế độ riêng tư không chia sẻ phiên với nhau. Kiểm tra Auth restore trước khi kết luận mất dữ liệu.
Không yêu cầu khách gửi OTP/password/token. Owner/staff và khách dùng phiên Auth tách biệt.

## Ảnh hoặc ghi chú không lưu

- Yêu cầu phải còn chờ xác nhận; ảnh/ghi chú chỉ lưu trước cộng điểm.
- Kiểm tra chi nhánh, nhân viên được giao, trạng thái salon và đồng ý lưu ảnh.
- Kiểm tra beginHaircutPhotoUpload -> Storage upload -> finalizeHaircutPhotoUpload ->
  getHaircutPhotoReadUrls. JPEG tối đa 3 MiB; Rules cần grant server cấp còn hiệu lực.
- Kiểm tra quyền Storage Rules đọc Firestore và quyền ký ảnh của runtime; không cấp quyền rộng
  hoặc mở ảnh công khai để chữa tạm.
- Note-only update phải giữ nguyên ảnh, không tự cộng điểm và không trả URL ảnh.
- Link ký hết hạn cần được cấp lại sau kiểm tra quyền; không biến link đó thành URL công khai dài hạn.

## Điểm không cập nhật hoặc cộng trùng

Đối chiếu point_requests, chair_sessions, haircut_records và audit bằng request ID của đúng salon.
Cùng thao tác phải giữ operation/request ID khi retry; không cộng bù trực tiếp trong Firestore.
Khách vừa được cộng điểm có cooldown hai giờ; không đổi giờ hoặc ID để bỏ qua.

Khách quen có thể trùng 4 số cuối. Phải chọn đúng tên/hồ sơ và chi nhánh, không tự gộp khách.

## Mã quà lỗi hoặc bị đổi hai lần

Kiểm tra trạng thái, thời hạn, chi nhánh được phép dùng và quyền nhân viên. Một mã chỉ chuyển
sang used một lần. Không sửa trạng thái trực tiếp hoặc làm mới idempotency key để đổi lại.

## Trang trắng, lỗi tải hoặc hiển thị bản cũ

Kiểm tra Hosting version, HTML/assets và console/network; tải lại trang để nhận bundle mới.
Đối chiếu source đã deploy, không nhầm code mới trên GitHub với website live.
Không dùng hướng dẫn Mini App hoặc native để sửa trang Web.

## Chi phí, lỗi tăng hoặc dữ liệu cần khôi phục

Kiểm tra invocations, Firestore reads/writes, Storage egress theo thời gian và phạm vi salon.
Dùng thao tác quản trị có audit và quyền rõ ràng. Giữ Rules đóng.
Việc restore/migration/xóa dữ liệu cần kế hoạch riêng tại [Production Operations](PRODUCTION_OPERATIONS.md).
Không đánh dấu job xóa hoàn tất nếu vẫn còn document hoặc object liên quan.
