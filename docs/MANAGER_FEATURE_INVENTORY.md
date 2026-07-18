# Kiểm kê chức năng HAIRCUT Manager

Tài liệu này là hợp đồng bảo toàn chức năng của lần thiết kế lại Manager. Registry chạy được nằm
tại `apps/manager-mobile/src/navigation/managerNavigation.ts` và được bảo vệ bởi
`managerFeatureParity.test.ts`.

## Tổng hợp

- **81 chức năng đã kiểm kê:** 49 Owner, 23 Staff và 9 chức năng nền dùng chung.
- **81/81 chức năng có vị trí mới:** tối đa ba lần chạm từ một trong năm tab đúng vai trò.
- Không thay đổi Cloud Functions, Firestore schema, quyền, transaction hoặc business rule.
- Mục ghi **Tạm chưa triển khai — cần xác nhận** là khoảng trống đã tồn tại trước lần thiết kế lại:
  Manager chưa có API đọc phù hợp. Mục vẫn có vị trí, không bị xóa hoặc giả lập dữ liệu.

Trạng thái chỉ dùng một trong các giá trị đã thống nhất:
`Giữ nguyên`, `Đổi vị trí`, `Đơn giản hóa giao diện`, `Chỉ hiện theo quyền`,
`Chỉ hiện theo feature flag`, `Tạm chưa triển khai — cần xác nhận`.

## Owner

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Tổng quan salon | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | parity + screen | Đổi vị trí |
| Lọc số liệu theo chi nhánh | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | parity | Giữ nguyên |
| Hàng chờ | Có | Có | StaffPage | Khách > Lượt hiện tại | `listenActiveSessions` | parity + screen | Đổi vị trí |
| Khách đang phục vụ | Có | Có | StaffPage | Khách > Lượt hiện tại | `listenActiveSessions` | parity + screen | Đổi vị trí |
| Lượt chờ duyệt | Có | Có | StaffPage/Duyệt | Khách > Lượt hiện tại | `listenActiveSessions` | parity + screen | Đổi vị trí |
| Lượt hoàn tất | Có | Có | Hồ sơ khách | Khách > Tìm khách > Lịch sử | `searchSalonCustomers` | parity | Đơn giản hóa giao diện |
| Lượt bị hủy | Có | Có | Chưa có màn hình riêng | Khách > Lịch sử | Chưa có API Manager đọc lịch sử phiên | parity | Tạm chưa triển khai — cần xác nhận |
| Không đến | Có | Có | Chưa có màn hình riêng | Khách > Lịch sử | Chưa có API Manager đọc lịch sử phiên | parity | Tạm chưa triển khai — cần xác nhận |
| Tìm khách | Có | Không | Khách | Khách > Tìm khách | `searchSalonCustomers` | parity + screen | Giữ nguyên |
| Hồ sơ khách | Có | Không | Khách | Khách > Tìm khách > Kết quả | `searchSalonCustomers` | parity | Đơn giản hóa giao diện |
| Điểm hiện tại | Có | Không | Khách | Khách > Hồ sơ | `searchSalonCustomers` | parity | Giữ nguyên |
| Lịch sử điểm | Có | Không | Khách | Khách > Hồ sơ > Lịch sử | `searchSalonCustomers` | parity | Đơn giản hóa giao diện |
| Lịch sử cắt tóc | Có | Không | Khách | Khách > Hồ sơ > Lịch sử | `searchSalonCustomers` | parity | Giữ nguyên |
| Ghi chú kiểu tóc | Có | Không | Khách | Khách > Hồ sơ > Lịch sử | `searchSalonCustomers` | parity | Giữ nguyên |
| Ảnh kiểu tóc có đồng ý | Có | Có | Duyệt | Khách > Hồ sơ > Ảnh | Chưa có API tìm khách trả ảnh | parity | Tạm chưa triển khai — cần xác nhận |
| Quà của khách | Có | Không | Khách | Khách > Hồ sơ > Quà chưa dùng | `searchSalonCustomers` | parity | Giữ nguyên |
| Lịch sử quà | Có | Không | Quà | Khách > Hồ sơ > Lịch sử quà | Chưa có API tìm khách trả đủ lịch sử quà | parity | Tạm chưa triển khai — cần xác nhận |
| Chi nhánh khách từng đến | Có | Không | Chưa có màn hình riêng | Khách > Hồ sơ > Lịch sử | Chưa có trong response tìm khách | parity | Tạm chưa triển khai — cần xác nhận |
| Nhân viên từng phục vụ | Có | Không | Khách | Khách > Hồ sơ > Lịch sử | `recentRecords.staffName` | parity | Giữ nguyên |
| Xóa dữ liệu khách | Có | Không | Khách | Khách > Hồ sơ | `deleteCustomerData` | parity | Giữ nguyên |
| Yêu cầu điểm đang chờ | Có | Không | Duyệt | Duyệt | `listenPendingPointRequests` | parity | Giữ nguyên |
| Ảnh trong yêu cầu điểm | Có | Không | Duyệt | Duyệt > Yêu cầu | photo services | parity | Giữ nguyên |
| Duyệt điểm | Có | Không | Duyệt | Duyệt > Yêu cầu | `approvePointRequest` | parity | Giữ nguyên |
| Từ chối điểm | Có | Không | Duyệt | Duyệt > Yêu cầu | `rejectPointRequest` | parity | Giữ nguyên |
| Lịch sử duyệt/từ chối | Có | Không | Chưa có danh sách riêng | Duyệt > Lịch sử duyệt | Chưa có API Manager đọc yêu cầu đã xử lý | parity | Tạm chưa triển khai — cần xác nhận |
| Quản lý chi nhánh | Có | Không | Chi nhánh | Quản lý > Chi nhánh và QR | branch services | parity + screen | Đổi vị trí |
| Quản lý nhân viên | Có | Không | Nhân viên | Quản lý > Nhân viên | staff services | parity + screen | Đổi vị trí |
| QR salon | Có | Không | Chi nhánh | Quản lý > Chi nhánh và QR | `getBranchQrSettings` | parity | Đổi vị trí |
| QR chi nhánh | Có | Không | Chi nhánh | Quản lý > Chi nhánh và QR | `getBranchQrSettings` | parity | Đổi vị trí |
| Sao chép/tải/in/chia sẻ QR | Có | Không | Chi nhánh | Quản lý > Chi nhánh và QR > Chi tiết | QR + native share | parity | Đơn giản hóa giao diện |
| Chuyển dữ liệu Gương 1 cũ | Có | Không | Chi nhánh | Quản lý > Chi nhánh và QR | `migrateSalonBranches` | parity | Đổi vị trí |
| Cấu hình điểm mỗi lượt | Có | Không | Thông tin salon | Cài đặt > Thông tin salon | `updateSalonProfile` | parity | Đổi vị trí |
| Cấu hình vòng quay | Có | Không | Vòng quay | Quản lý > Quà và vòng quay | wheel services | parity | Đổi vị trí |
| Quản lý quà | Có | Không | Vòng quay/Quà | Quản lý > Quà và vòng quay | wheel/reward services | parity | Đổi vị trí |
| Đổi mã quà | Có | Có điều kiện | Quà | Quản lý > Đổi quà | reward services | parity | Chỉ hiện theo quyền |
| Báo cáo hiện có | Có | Không | Tổng | Hôm nay / Quản lý > Báo cáo | `getOwnerOverview` | parity + screen | Đơn giản hóa giao diện |
| Trạng thái quyền xem audit | Có | Không | Không hiển thị | Quản lý > Nhật ký hoạt động | `audit_events` server-only | parity + screen | Chỉ hiện theo quyền |
| Thông tin salon | Có | Không | Tổng | Cài đặt > Thông tin salon | salon services | parity | Đổi vị trí |
| Logo/avatar salon | Có | Không | Tổng | Cài đặt > Nhận diện salon | salon branding services | parity | Đổi vị trí |
| Avatar chủ salon | Có | Không | Tổng | Cài đặt > Tài khoản chủ | auth/avatar services | parity | Đổi vị trí |
| Tài khoản chủ | Có | Không | Thanh tài khoản | Cài đặt | Firebase Auth | parity | Đổi vị trí |
| Đặt lại mật khẩu | Có | Có | Cổng đăng nhập | Cài đặt > Bảo mật | Firebase Auth | parity | Đổi vị trí |
| Trạng thái thông báo | Có | Có | Native shell | Cài đặt > Bảo mật > Ứng dụng | Firebase Messaging | parity | Đơn giản hóa giao diện |
| Sinh trắc học | Có | Có | Native shell | Cài đặt > Bảo mật | Biometric/Secure Storage | parity | Đổi vị trí |
| Hỗ trợ | Có | Có | Cuối trang | Cài đặt > Hỗ trợ và pháp lý | email/phone | parity | Đổi vị trí |
| Privacy | Có | Có | Cuối trang | Cài đặt > Hỗ trợ và pháp lý | `/privacy` | parity | Đổi vị trí |
| Terms | Có | Có | Cuối trang | Cài đặt > Hỗ trợ và pháp lý | `/terms` | parity | Đổi vị trí |
| Xóa salon | Có | Không | Cuối trang | Cài đặt > Dữ liệu và tài khoản | salon deletion services | parity | Đổi vị trí |
| Đăng xuất | Có | Có | Thanh tài khoản | Cài đặt > Tài khoản chủ | Firebase Auth + token cleanup | parity | Đổi vị trí |

## Staff

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Chi nhánh được phân công | Có | Có | Đầu StaffPage | Hàng chờ / Tài khoản | branch services | parity | Đổi vị trí |
| Hàng chờ | Có | Có | StaffPage | Hàng chờ | `listenActiveSessions` | parity + screen | Đổi vị trí |
| Nhận khách | Có | Có | Thẻ lượt | Hàng chờ > Chi tiết | `claimServiceSession` | parity | Giữ nguyên |
| Khách đang phục vụ | Có | Có | Thẻ lượt | Đang làm | `listenActiveSessions` | parity + screen | Đổi vị trí |
| Ghi chú kiểu tóc | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | UI state + `submitPointRequest` | parity | Giữ nguyên |
| Ảnh có đồng ý | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | photo services | parity | Giữ nguyên |
| Hoàn tất lượt | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | `submitPointRequest` | parity | Giữ nguyên |
| Không đến | Có | Có | Chi tiết lượt | Hàng chờ > Chi tiết | `cancelServiceSession` | parity | Giữ nguyên |
| Hủy lượt | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | `cancelServiceSession` | parity | Giữ nguyên |
| Gửi yêu cầu điểm | Có | Có | Chi tiết lượt | Đang làm / Điểm và quà | `submitPointRequest` | parity + screen | Đổi vị trí |
| Trạng thái điểm | Có | Có | Danh sách lượt | Lịch sử | `listenActiveSessions` | parity | Đổi vị trí |
| Đổi mã quà | Có | Có điều kiện | Cuối StaffPage | Điểm và quà | reward services | parity + screen | Chỉ hiện theo quyền |
| Lịch sử đổi quà | Có | Có điều kiện | Chưa có màn hình riêng | Lịch sử | Chưa có API theo staff | parity | Tạm chưa triển khai — cần xác nhận |
| Lịch sử thao tác | Có | Có | Danh sách lượt | Lịch sử | Luồng hiện có chỉ trả lượt mở | parity + screen | Tạm chưa triển khai — cần xác nhận |
| Tài khoản | Có | Có | Thanh tài khoản | Tài khoản | Firebase Auth | parity | Đổi vị trí |
| Đặt lại mật khẩu | Có | Có | Cổng đăng nhập | Tài khoản > Bảo mật | Firebase Auth | parity | Đổi vị trí |
| Trạng thái thông báo | Có | Có | Native shell | Tài khoản > Bảo mật > Ứng dụng | Firebase Messaging | parity | Đơn giản hóa giao diện |
| Sinh trắc học | Có | Có | Native shell | Tài khoản > Bảo mật | Biometric/Secure Storage | parity | Đổi vị trí |
| Hỗ trợ | Có | Có | Cuối StaffPage | Tài khoản > Hỗ trợ | email/phone | parity | Đổi vị trí |
| Privacy | Có | Có | Cuối StaffPage | Tài khoản > Hỗ trợ | `/privacy` | parity | Đổi vị trí |
| Terms | Có | Có | Cuối StaffPage | Tài khoản > Hỗ trợ | `/terms` | parity | Đổi vị trí |
| Xóa tài khoản cá nhân | Không | Có | Cuối StaffPage | Tài khoản > Dữ liệu và tài khoản | `deletePersonalAccount` | parity | Đổi vị trí |
| Đăng xuất | Có | Có | Thanh tài khoản | Tài khoản | Firebase Auth + token cleanup | parity | Đổi vị trí |

## Chức năng nền dùng chung

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Đăng nhập/đăng ký/hoàn tất salon | Có | Có | AuthGate dùng chung | Cổng đăng nhập Manager | auth adapter | parity | Đơn giản hóa giao diện |
| Offline | Có | Có | Native shell | Banner toàn ứng dụng | Capacitor Network | parity | Giữ nguyên |
| App Check | Có | Có | Bootstrap | Nền ứng dụng | Firebase App Check | bootstrap tests | Giữ nguyên |
| Deep link | Có | Có | Native shell | Điều hướng đúng tab | Capacitor App | navigation test | Giữ nguyên |
| Feature flags | Có | Có | Backend | Trạng thái tạm ngừng tại ngữ cảnh | Functions contracts | parity | Chỉ hiện theo feature flag |
| Không có quyền | Có | Có | AuthGate | Cổng đăng nhập / màn trạng thái | auth adapter | parity | Chỉ hiện theo quyền |
| Thử lại lỗi | Có | Có | Nhiều vị trí | Ngay cạnh lỗi | UI state | screen tests | Đơn giản hóa giao diện |
| Quét mã quà | Có | Có điều kiện | Native shell | Đổi quà đúng role | Barcode Scanner | native tests | Chỉ hiện theo quyền |
| Push notification | Có | Có | Native shell | Nền ứng dụng + trạng thái tài khoản | Firebase Messaging | native tests | Giữ nguyên |

## Kết luận parity

- Số chức năng bị loại bỏ: **0**
- Số chức năng chưa có vị trí mới: **0**
- Business rule bị thay đổi: **Không**
- Backend schema bị thay đổi: **Không**
