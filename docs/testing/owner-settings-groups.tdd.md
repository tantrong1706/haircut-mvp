# Cài đặt Chủ salon — ba nhóm gọn

Theo yêu cầu “gom lại thành từng nhóm, chỉ hiện vài cái thôi”: mở Cài đặt chỉ thấy **Thông tin salon**, **Vận hành**, **Tài khoản & dữ liệu**. Mỗi lần mở tối đa một nhóm, bấm lại để thu gọn.

- **Thông tin salon**: tên, hotline và giờ mở cửa. Các công tắc hiển thị và ảnh/logo chỉ bung khi cần. Xem trước giữ nguyên dữ liệu theo chi nhánh.
- **Vận hành**: số nội bộ, điểm mỗi lượt, công tắc tích điểm/quay thưởng và các lối tắt hiện có.
- **Tài khoản & dữ liệu**: ảnh cá nhân và liên kết quản lý xóa/hủy yêu cầu ở `/delete-account/manage`, qua cổng đăng nhập và xác nhận sẵn có. Không có biểu mẫu mật khẩu hay hành động xóa ngay trong danh sách cài đặt.
- Hồ sơ và Vận hành dùng chung bản nháp. Đổi hoặc đóng nhóm không ghi dữ liệu. Nút Lưu vẫn gọi thao tác cũ; không đổi kiểu dữ liệu, quyền hoặc lịch xóa.

## Kiểm thử

- RED `a000dc6`: ca hồi quy chạy và thất bại vì chưa có điều hướng “Nhóm cài đặt”.
- GREEN `8ed63d6`: 21 ca Vitest cho OwnerPage và SalonProfilePanel đạt; hai thành phần cài đặt đạt 100% dòng, 96% nhánh. Các ca kiểm tra giữ bản nháp qua nhóm, lưu đúng trường công khai/nội bộ, xem trước không gửi dữ liệu và không ghi khi chuyển nhóm.
- Playwright Chủ salon: 65/65 đạt trên 320 px, 360 px, WebKit iPhone, tablet và desktop. Kiểm tra màn đầu chỉ có ba lựa chọn, thao tác bàn phím, khả năng tiếp cận, đóng/mở nhóm, đường dẫn quản lý xóa và các lối tắt gốc. Đã xem ảnh đầu màn ở 320 px.
- Bộ Web: 416 ca Vitest đạt. Lần dựng đầu báo tham số `exact` không có trong kiểu của Testing Library; bỏ tham số thừa chỉ trong test. Chạy lại 21 ca liên quan, lint, định dạng, TypeScript và dựng Web production đều đạt.

## Bổ sung trước phát hành

- RED `eb1f119`: để trống tên rồi sang **Vận hành** chặn lưu nhưng không có giải thích. Sau sửa, thông báo hiện kèm **Sửa tên hiển thị**; mở đúng nhóm và đưa tiêu điểm về ô tên, giữ bản nháp vận hành. 22 ca Vitest liên quan đạt, hai thành phần cài đặt đạt 100% dòng và 96,42% nhánh.
- RED `c0dbe98`: bản dựng Web truy cập trực tiếp `/delete-account/manage` không tải thư viện từ thư mục gốc, nên không hiện đăng nhập. Đặt đường dẫn tài nguyên Web tại gốc site. Chạy lại 9 ca cổng đăng nhập trên Chromium desktop/mobile và WebKit iPhone đều đạt. Không đổi đường dẫn quản lý, xác thực, xác nhận xóa hoặc chức năng phía máy chủ.
