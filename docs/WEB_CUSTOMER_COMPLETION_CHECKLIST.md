# CH Hair — một checklist hoàn thành

Yêu cầu chốt: hoàn thiện luồng đã thảo luận, giữ đơn giản; không phát sinh thêm sản phẩm hoặc đổi kiến trúc.
Đây là danh sách công việc chung, không chia các hạng mục thành "làm sau".

## Hành vi phải đạt

- [x] Khách xác thực Phone OTP lần đầu; Firebase nhớ phiên; đóng/mở lại cùng browser không yêu cầu OTP.
- [x] Khách đã có hồ sơ xem điểm, lịch sử và quà khi mở web, không phải tạo lượt mới để xem.
- [x] Chỉ QR đã xác minh mới tạo yêu cầu tại đúng chi nhánh; không cho sửa branch bằng query string.
- [x] Khách nhấn yêu cầu tích điểm; nhân viên đúng chi nhánh xác nhận sau phục vụ; không bắt nhận khách rồi gửi owner lần nữa.
- [x] Hai giờ tính từ lúc cộng điểm thành công, áp dụng trong salon; trong thời gian này vẫn xem dữ liệu.
- [x] Nhấn trùng, nhiều tab, retry không tạo yêu cầu hay cộng/trừ điểm hai lần.
- [x] Đăng xuất/đổi UID không để dữ liệu khách cũ còn trên màn hình hoặc từ request đang chạy.
- [x] Nhân viên chụp/lưu ảnh đúng lượt và quyền; lỗi tải có retry, không báo điểm thành công giả.
- [x] Điểm, wheel, rewards, history và ảnh chỉ thuộc đúng UID/salon; staff không thấy PII ngoài quyền.
- [x] Quà ghi rõ trạng thái, hạn và phạm vi; mã dự phòng hoạt động; scan chỉ tra cứu, cần xác nhận đổi quà.
- [x] Thao tác sửa nhầm được kiểm tra qua quyền owner và nhật ký hiện có; không tự merge tài khoản theo số điện thoại.
- [x] Hướng dẫn hỗ trợ số điện thoại/điểm Zalo cũ/ảnh và tên hiển thị rõ, không hứa tự chuyển dữ liệu.
- [x] UI mobile có loading/error/retry rõ; không thêm form dài hoặc đổi toàn bộ giao diện.
- [x] Rà tools GitHub đã đề xuất; ZXing và axe-core được thêm có kiểm thử, TanStack Query được loại vì chưa cần.
- [x] Functions, Rules, Web, Manager, Zalo, secret scan và E2E có kết quả thực tế.
- [x] Cấu hình Phone provider và SMS Việt Nam (`VN`) được bật, hậu kiểm không đổi domain/cấu hình khác.
- [x] OTP thật + đóng/mở browser được người dùng kiểm tra trên production custom domain.
- [x] Có đúng danh sách resource deploy và rollback; chỉ thực hiện khi người dùng nói rõ "deploy".

## Giới hạn còn hiệu lực

Không push/merge, không sửa Gateway/Cloudflared, xoay secret, publish Zalo hoặc gửi review. App Check
enforcement vẫn OFF cho đến khi attestation pilot ổn định; không hạ ngưỡng reCAPTCHA để ép PASS.

## Trạng thái chốt production

Luồng account, QR chi nhánh, yêu cầu điểm, xác nhận nhân viên, cooldown, QR quà và accessibility đã
được triển khai và kiểm thử. Web pass 214/214 unit, 42 E2E thực thi và 3 ca chụp ảnh review được skip
có chủ ý. Functions pass 108/108 unit và 77/77 integration; Rules 22/22; Manager 78/78; Zalo
readiness 34/34. Phone provider/SMS Việt Nam, OTP thật, Auth persistence, multi-salon isolation,
staff confirmation, point award, history và cooldown 2 giờ đã được chứng minh trên production.
Lượt test thứ hai tăng điểm từ 1 lên 2; khi quét lại QR trong cooldown, chủ dự án xác nhận nút yêu cầu
tích điểm đã ẩn. Test UI xác nhận không hiện thời gian đếm ngược.
Mười lăm Functions và Hosting đã deploy; Rules/Storage/indexes, Zalo, Gateway và Cloudflared không đổi.
