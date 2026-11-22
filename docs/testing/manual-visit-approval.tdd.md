# Lượt khách trực tiếp — chờ xác nhận như QR

Phạm vi theo yêu cầu: Chủ salon dùng **Duyệt điểm → Thêm khách trực tiếp**; Nhân viên dùng cùng biểu mẫu ngay trước danh sách lượt chờ tại chi nhánh được phân công. Tên và SĐT ban đầu để trống. Tên bắt buộc, SĐT không bắt buộc. Lưu tạo lượt chờ 2 giờ, không tạo lượt đã hoàn tất hoặc tự cộng điểm.

## Kiểm thử theo yêu cầu

- RED `6078679`: máy chủ chỉ trả hồ sơ mà không có lượt chờ, từ chối số đã tồn tại và chưa kiểm tra tham số tạo lượt. Trình duyệt không có nút ở Duyệt điểm.
- RED `dd3469e`: nút chụp ảnh của Chủ salon vẫn bật theo quyền cũ trong hồ sơ dù lượt hiện tại chưa có đồng ý ảnh.
- Sau sửa, máy chủ ghi hồ sơ/lượt chờ/yêu cầu/con trỏ trong cùng giao dịch. Gửi lại cùng mã thao tác không tạo lượt thứ hai. Số duy nhất đã có trong salon được đối chiếu đầy đủ và dùng lại hồ sơ, giữ tên, điểm và định danh cũ; nhiều hồ sơ cùng số phải được xử lý thủ công, không tự gộp.
- Xác nhận điểm vẫn dùng API hiện có, giữ quyền chi nhánh, thời gian chống cộng lặp 2 giờ, ghi chú và cơ chế tải ảnh hiện có. Không ghi đè yêu cầu QR đang mở. Không cho phép tạo hai lượt đồng thời cho cùng một hồ sơ.
- Chụp/lưu ảnh cần ô xác nhận riêng, không tích sẵn. Tạo lượt không rút quyền lưu ảnh cũ nhưng quyền của lượt hiện tại vẫn bị chặn nếu chưa được xác nhận. Không gửi OTP hoặc nối tài khoản đăng nhập chỉ vì biết tên/số.

Các kiểm thử dùng Firestore giả lập và hồ sơ trình duyệt giả. Phát hành được giới hạn ở Customer Hosting và `createManualCustomer`; không triển khai Rules, indexes, Admin, API nghiệp vụ khác, secrets hoặc IAM.

## Kết quả trước khi chạy CI

- Firestore giả lập: 6 ca mục tiêu đạt, gồm luồng tạo lượt → lưu ghi chú → duyệt, gọi duyệt lặp, hai thao tác đồng thời, giữ nguyên lượt QR và thời gian chống cộng lặp. Hai mô-đun thủ công đạt 90,98% dòng và 86,66% nhánh.
- Biểu mẫu: 5 ca đạt, coverage 97,18% dòng và 90,41% nhánh. Bài kiểm thử tích hợp trang Nhân viên xác nhận lượt mới hiện trong hàng chờ, chưa gọi API cộng điểm.
- Trình duyệt: Chủ salon 65 ca đạt trên 320/360 px, WebKit iPhone, tablet và desktop; Nhân viên 12 ca đạt trên Chromium desktop/mobile và WebKit.
- Kiểm tra kiểu và lint đạt. Bộ kiểm thử luồng chủ salon cũ, biểu mẫu, nhân viên và đồng ý ảnh đã chạy, không kiểm tra bằng dữ liệu khách thật.
