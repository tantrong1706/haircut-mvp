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

## Bổ sung sau rà soát PR

- RED `24d32a8`: kiểm thử phản hồi đến trước snapshot vẫn chọn nhầm lượt cũ; ba dạng số đầy đủ trên hồ sơ cũ thiếu `phoneLast4` bị từ chối ở giới hạn 50 khách. Sau sửa, 9 ca trang Nhân viên và 9 ca tích hợp thủ công đều đạt. Lượt vừa tạo được giữ lựa chọn trong khi chờ snapshot, không cho thao tác nhầm khách; hồ sơ cũ được tìm theo toàn bộ số, trong đúng salon, trước kiểm tra hạn mức. Trùng nhiều hồ sơ vẫn từ chối, không tự gộp. Bỏ thông báo cố định 30 phút không đúng.
- Giữ phương án bảo thủ với con trỏ lượt cũ: thao tác thủ công không ghi đè bất kỳ lượt QR còn tồn tại nào, kể cả đang chờ tác vụ hết hạn dọn dẹp. Nhân viên xử lý lượt hiện tại hoặc chờ tác vụ định kỳ, không khôi phục hay sửa ảnh/ghi chú của lượt QR trong API thêm khách. Đây là giới hạn có chủ đích để giữ phạm vi phát hành nhỏ.
- Đo coverage sau bản sửa: lần đầu ca cạnh tranh giao dịch vượt 5 giây; tăng riêng thời gian chờ ca này lên 15 giây để bao gồm backoff của Firestore, không bỏ assertion hoặc tự retry toàn bộ bộ kiểm thử. Chạy lại 9/9 ca mục tiêu đạt; hai mô-đun đạt 92,12% dòng, 87,27% nhánh và 100% hàm. Bản production Web xây dựng thành công.
