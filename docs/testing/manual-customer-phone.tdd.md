# Thêm khách thủ công cho chủ salon và nhân viên

Chủ salon dùng **Khách hàng → Thêm khách**. Nhân viên chọn chi nhánh được phân công rồi dùng **Thêm khách** ở mục Khách quen. Tên bắt buộc, số di động Việt Nam không bắt buộc. Hai cách nhập `0…` và `+84…` được chuẩn hóa về cùng một số.

- **RED (`330161f`)**: kiểm thử Firestore tái hiện API chưa cho nhân viên thêm hồ sơ và vẫn chấp nhận số có chữ; kiểm thử trình duyệt không tìm thấy nút Thêm khách.
- **GREEN — Firestore giả lập**: 3 ca mục tiêu đạt, gồm hạn mức 49/50/51, gửi lại không tạo trùng, chống ghi đè hồ sơ cũ có cùng số, chặn số sai và chi nhánh không được giao. Mô-đun mới: 92,75% dòng, 87,67% nhánh. Không chạy toàn bộ tích hợp; lần thử mở rộng bị kẹt ở khởi động Storage giả lập và đã dừng.
- **GREEN — Web**: 37 ca kiểm thử tập trung đạt; biểu mẫu mới đạt 97,98% dòng và 88,37% nhánh. 60 kiểm thử trình duyệt Chủ salon và 12 Nhân viên đạt; kiểm tra khả năng tiếp cận của biểu mẫu nhân viên đạt. Lint, định dạng, kiểm tra kiểu và bản dựng Web với cấu hình CI đều đạt.
- **Functions**: lint, định dạng, kiểm tra kiểu, 119 ca unit và bản dựng đạt.

Thêm hồ sơ không gửi OTP, không cấp quyền tích điểm/đổi quà, không ghi nhận lượt cắt và không thay đổi hồ sơ đăng nhập. Máy chủ kiểm tra lại quyền theo salon/chi nhánh và ghi nhật ký không chứa tên hoặc số điện thoại. Danh bạ dùng chỉ mục 4 số cuối hiện có để tìm bản ghi ứng viên, sau đó mới so toàn bộ số; không coi 4 số cuối trùng là cùng một khách. Không thay đổi dữ liệu hoặc cấu hình production; chưa phát hành.
