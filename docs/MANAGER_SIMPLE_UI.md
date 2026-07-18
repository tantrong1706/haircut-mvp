# HAIRCUT Manager đơn giản nhưng đầy đủ

## Mục tiêu

Giao diện mới giữ toàn bộ nghiệp vụ hiện có nhưng giảm tải nhận thức: năm tab theo role, một nhiệm
vụ chính mỗi màn hình, nút tối thiểu 48 px và mọi chức năng có vị trí trong tối đa ba lần chạm.

## Điều hướng

### Owner

1. **Hôm nay:** việc cần xử lý, hàng chờ, đang phục vụ và số liệu ngắn.
2. **Khách:** ba trạng thái vận hành trước; tìm hồ sơ là chế độ thứ hai.
3. **Duyệt:** chỉ ưu tiên yêu cầu đang chờ.
4. **Quản lý:** chi nhánh/QR, nhân viên, khách, điểm, quà/vòng quay, báo cáo, audit và mục thêm.
5. **Cài đặt:** salon, branding, tài khoản, mật khẩu, ứng dụng, dữ liệu và pháp lý.

### Staff

1. **Hàng chờ:** khách tiếp theo tại đúng chi nhánh.
2. **Đang làm:** khách đang phục vụ, ảnh, ghi chú và hoàn tất.
3. **Điểm và quà:** lối vào gửi điểm và đổi mã quà theo quyền.
4. **Lịch sử:** Hôm nay, 7 ngày hoặc 30 ngày.
5. **Tài khoản:** role, chi nhánh, mật khẩu, ứng dụng, dữ liệu và pháp lý.

## Trạng thái giao diện

- Loading và retry nằm ngay tại nội dung gặp lỗi.
- Empty state giải thích điều gì sẽ xảy ra tiếp theo.
- Offline banner áp dụng toàn ứng dụng.
- Hành động ghi có busy/disabled state và xác nhận khi nhạy cảm.
- Role/feature flag không hợp lệ hiển thị trạng thái rõ; backend authorization giữ nguyên.
- Bootstrap luôn thoát splash và có nút thử lại.

## Preview phát triển

Chỉ trong `DEV`, mở:

```text
http://127.0.0.1:5176/?preview=owner-today
http://127.0.0.1:5176/?preview=owner-customers
http://127.0.0.1:5176/?preview=owner-approvals
http://127.0.0.1:5176/?preview=owner-management
http://127.0.0.1:5176/?preview=staff-queue
http://127.0.0.1:5176/?preview=staff-active
```

Mock preview bị loại khỏi nhánh production bởi `import.meta.env.DEV`.

## Kiểm tra responsive

Sáu prototype đã được kiểm tra tại `360 × 800`, `390 × 844`, `412 × 915`:

- Không tràn ngang.
- Bottom navigation cố định đúng đáy viewport.
- Không có vùng chạm nhỏ hơn 48 px.
- Không có lỗi console.

| Màn hình | 360 × 800 | 390 × 844 | 412 × 915 |
| --- | --- | --- | --- |
| Owner — Hôm nay | [Ảnh](screenshots/manager-simple-ui/owner-today-360x800.png) | [Ảnh](screenshots/manager-simple-ui/owner-today-390x844.png) | [Ảnh](screenshots/manager-simple-ui/owner-today-412x915.png) |
| Owner — Khách | [Ảnh](screenshots/manager-simple-ui/owner-customers-360x800.png) | [Ảnh](screenshots/manager-simple-ui/owner-customers-390x844.png) | [Ảnh](screenshots/manager-simple-ui/owner-customers-412x915.png) |
| Owner — Duyệt | [Ảnh](screenshots/manager-simple-ui/owner-approvals-360x800.png) | [Ảnh](screenshots/manager-simple-ui/owner-approvals-390x844.png) | [Ảnh](screenshots/manager-simple-ui/owner-approvals-412x915.png) |
| Owner — Quản lý | [Ảnh](screenshots/manager-simple-ui/owner-management-360x800.png) | [Ảnh](screenshots/manager-simple-ui/owner-management-390x844.png) | [Ảnh](screenshots/manager-simple-ui/owner-management-412x915.png) |
| Staff — Hàng chờ | [Ảnh](screenshots/manager-simple-ui/staff-queue-360x800.png) | [Ảnh](screenshots/manager-simple-ui/staff-queue-390x844.png) | [Ảnh](screenshots/manager-simple-ui/staff-queue-412x915.png) |
| Staff — Đang làm | [Ảnh](screenshots/manager-simple-ui/staff-active-360x800.png) | [Ảnh](screenshots/manager-simple-ui/staff-active-390x844.png) | [Ảnh](screenshots/manager-simple-ui/staff-active-412x915.png) |

## Khoảng trống không bị che giấu

Một số màn hình chi tiết chưa có API Manager phù hợp từ trước: lịch sử phiên đã hủy/no-show, lịch sử
duyệt đầy đủ, ảnh trong kết quả tìm khách, lịch sử quà theo staff và audit log cho owner. Các mục này
đã có vị trí trong inventory, được ghi rõ `Tạm chưa triển khai — cần xác nhận` hoặc `Chỉ hiện theo
quyền`; lần thiết kế lại không tạo dữ liệu giả và không nới Rules.
