# Kiểm kê chức năng HAIRCUT Manager

Tài liệu này là hợp đồng bảo toàn chức năng khi thiết kế lại HAIRCUT Manager. Mọi chức năng
đang có phải được giữ, đổi vị trí có chủ đích hoặc chỉ hiển thị theo quyền/feature flag. Không
được xóa chức năng bằng cách ẩn khỏi giao diện.

## Chủ salon

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xem số khách hôm nay, 7 ngày, 30 ngày | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem yêu cầu chờ duyệt, điểm đã cộng, lượt quay, quà chưa dùng | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Lọc tổng quan theo chi nhánh | Có | Không | Tổng | Hôm nay | `getOwnerOverview`, `getBranchQrSettings` | `managerNavigation.test.ts` | Giữ nguyên |
| Làm mới tổng quan | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xem khách lâu chưa quay lại | Có | Không | Tổng | Hôm nay | `getOwnerOverview` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Tìm khách theo tên hoặc 4 số cuối SĐT | Có | Không | Khách | Khách | `searchSalonCustomers` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xem điểm, lần ghé gần nhất, lịch sử gần đây | Có | Không | Khách | Khách > Chi tiết | `searchSalonCustomers` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Xem và sao chép mã quà chưa dùng của khách | Có | Không | Khách | Khách > Chi tiết | `searchSalonCustomers` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Tải thêm kết quả tìm khách | Có | Không | Khách | Khách | `searchSalonCustomers` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xóa toàn bộ dữ liệu một khách | Có | Không | Khách | Khách > Chi tiết | `deleteCustomerData` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem yêu cầu cộng điểm đang chờ | Có | Không | Duyệt & ảnh | Duyệt | `listenPendingPointRequests` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Lọc yêu cầu theo chi nhánh | Có | Không | Duyệt & ảnh | Duyệt | `listenPendingPointRequests` | `managerNavigation.test.ts` | Giữ nguyên |
| Chụp/chọn tối đa 3 ảnh khi khách đồng ý | Có | Có | Duyệt & ảnh | Duyệt > Yêu cầu | `uploadHaircutPhoto` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Xóa ảnh trước khi duyệt | Có | Có | Duyệt & ảnh | Duyệt > Yêu cầu | `deleteHaircutPhoto`, `updatePendingPointRequestPhotos` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Duyệt yêu cầu cộng điểm có xác nhận | Có | Không | Duyệt & ảnh | Duyệt > Yêu cầu | `approvePointRequest` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Từ chối yêu cầu cộng điểm có xác nhận | Có | Không | Duyệt & ảnh | Duyệt > Yêu cầu | `rejectPointRequest` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xem QR chung của salon | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR | `getBranchQrSettings` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Tạo, sửa, khóa/mở chi nhánh | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR | `createBranch`, `updateBranch` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem QR riêng từng chi nhánh | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR | `getBranchQrSettings` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Chia sẻ, sao chép, tải và in QR | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR > Chi tiết | Web/native share, `qrcode` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Tạo lại QR salon có cảnh báo | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR > Chi tiết | `rotateSalonQr` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Tạo lại QR chi nhánh có cảnh báo | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR > Chi tiết | `rotateBranchQr` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Chuyển dữ liệu Gương 1 cũ | Có | Không | Chi nhánh | Quản lý > Chi nhánh & QR | `migrateSalonBranches` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem danh sách nhân viên | Có | Không | Nhân viên | Quản lý > Nhân viên | `listenStaffProfiles` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Tạo nhân viên và gửi email mời | Có | Không | Nhân viên | Quản lý > Nhân viên | `createStaffProfile` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Gửi lại email mời | Có | Không | Nhân viên | Quản lý > Nhân viên > Chi tiết | `sendStaffInviteEmail` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Sửa tên, SĐT và chi nhánh nhân viên | Có | Không | Nhân viên | Quản lý > Nhân viên > Chi tiết | `updateStaffProfile` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Bật/tắt tài khoản nhân viên | Có | Không | Nhân viên | Quản lý > Nhân viên > Chi tiết | `updateStaffProfile` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Cấp/thu quyền đổi quà | Có | Không | Nhân viên | Quản lý > Nhân viên > Chi tiết | `updateStaffProfile` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Cấu hình điểm quay, hạn quà, trừ điểm và 6 ô | Có | Không | Vòng quay | Quản lý > Vòng quay | `getLuckyWheelConfig`, `saveLuckyWheelConfig` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Kiểm tra và xác nhận mã quà | Có | Có điều kiện | Quà | Quản lý > Đổi quà | `lookupRewardCode`, `redeemRewardCode` | `managerFeatureParity.test.ts` | Chỉ hiện theo quyền |
| Hoàn tác đổi quà bấm nhầm | Có | Không | Quà | Quản lý > Đổi quà | `restoreRewardCode` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem/sửa tên, địa chỉ, SĐT, điểm mỗi lượt | Có | Không | Tổng | Cài đặt > Thông tin salon | `getSalonProfile`, `updateSalonProfile` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem, tải, thay và xóa ảnh salon | Có | Không | Tổng | Cài đặt > Nhận diện salon | `uploadSalonAvatarFile`, `removeSalonAvatar` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem, tải, thay và xóa avatar chủ | Có | Không | Tổng | Cài đặt > Tài khoản chủ | `uploadOwnerAvatarFile`, `updateOwnerAvatar` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem trạng thái, yêu cầu và hủy xóa salon | Có | Không | Cài đặt | Cài đặt > Dữ liệu & tài khoản | `getFullSalonDeletionStatus`, `requestFullSalonDeletion`, `cancelFullSalonDeletion` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |

## Nhân viên

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xem chi nhánh được phân công | Có | Có | Đầu trang | Hàng chờ / Tài khoản | `getBranchQrSettings` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem số lượt chờ, đang làm, chờ duyệt và điểm/lượt | Có | Có | Đầu trang | Hàng chờ | `listenActiveSessions`, `getSalonProfile` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Xem hàng chờ đúng chi nhánh | Có | Có | Khách đang chờ | Hàng chờ | `listenActiveSessions` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xem chi tiết khách, điểm, SĐT ẩn và trạng thái | Có | Có | Khách đang chờ | Hàng chờ > Chi tiết | `listenActiveSessions` | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Nhận khách đang chờ | Có | Có | Khách đang chờ | Hàng chờ > Chi tiết | `claimServiceSession` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Đóng lượt khách không đến | Có | Có | Khách đang chờ | Hàng chờ > Chi tiết | `cancelServiceSession` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xem lượt mình đang phục vụ | Có | Có | Khách đang chờ | Đang làm | `listenActiveSessions` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Chụp/chọn/xóa ảnh kiểu tóc theo đồng ý | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | `uploadHaircutPhoto`, `deleteHaircutPhoto` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Thêm ghi chú nhanh và ghi chú tự do | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | Trạng thái giao diện | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Gửi yêu cầu cộng điểm đúng điểm/lượt | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | `submitPointRequest` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Hủy lượt đang phục vụ | Có | Có | Chi tiết lượt | Đang làm > Chi tiết | `cancelServiceSession` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Xem các lượt đã gửi chờ duyệt | Có | Có | Danh sách chung | Lịch sử | `listenActiveSessions` | `managerFeatureParity.test.ts` | Đổi vị trí |
| Kiểm tra và đổi mã quà | Có | Có điều kiện | Cuối trang | Điểm và quà | `lookupRewardCode`, `redeemRewardCode` | `managerFeatureParity.test.ts` | Chỉ hiện theo quyền |
| Xem trạng thái quyền đổi quà | Có | Có | Đầu trang | Điểm và quà | Hồ sơ người dùng | `managerFeatureParity.test.ts` | Đổi vị trí |
| Xóa tài khoản cá nhân | Không | Có | Cuối trang | Tài khoản > Dữ liệu & tài khoản | `deletePersonalAccount` | `managerFeatureParity.test.ts` | Đổi vị trí |

## Chức năng dùng chung và native

| Chức năng | Owner | Staff | Vị trí cũ | Vị trí mới | API/service | Test bảo vệ | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Đăng nhập, đăng ký owner, hoàn tất hồ sơ salon | Có | Có | Cổng đăng nhập dùng chung Zalo web | Cổng đăng nhập Manager | Auth adapter | `managerFeatureParity.test.ts` | Đơn giản hóa giao diện |
| Quên mật khẩu qua email | Có | Có | Cổng đăng nhập dùng chung Zalo web | Cổng đăng nhập Manager | `requestOwnerStaffPasswordReset` | `managerFeatureParity.test.ts` | Giữ nguyên |
| Đăng xuất an toàn và hủy device token | Có | Có | Thanh tài khoản | Cài đặt/Tài khoản | `signOutOwnerStaff`, native cleanup | `managerFeatureParity.test.ts` | Đổi vị trí |
| Hiển thị mất mạng | Có | Có | Banner native | Toàn ứng dụng | Capacitor Network | `managerFeatureParity.test.ts` | Giữ nguyên |
| Thử lại khi bootstrap lỗi và luôn ẩn splash | Có | Có | Native shell | Toàn ứng dụng | `runManagerBootstrap` | `managerBootstrap.test.ts` | Giữ nguyên |
| Bật/tắt khóa sinh trắc học | Có | Có | Thanh native | Cài đặt/Tài khoản | Biometric, Secure Storage | `managerFeatureParity.test.ts` | Đổi vị trí |
| Quét mã quà bằng camera | Có | Có điều kiện | Thanh native | Quản lý > Đổi quà / Điểm và quà | Barcode Scanner | `nativeRuntime.test.ts` | Chỉ hiện theo quyền |
| Nhận thông báo và mở đúng màn hình | Có | Có | Native shell | Toàn ứng dụng | Firebase Messaging, deep link | `managerNavigation.test.ts` | Giữ nguyên |
| Màn hình không quyền | Có | Có | Auth gate | Cổng đăng nhập Manager | Auth adapter | `managerFeatureParity.test.ts` | Giữ nguyên |

## Điều hướng chính

- Owner: **Hôm nay · Khách · Duyệt · Quản lý · Cài đặt**
- Staff: **Hàng chờ · Đang làm · Điểm và quà · Lịch sử · Tài khoản**
- Mọi chức năng trong bảng có thể mở trong tối đa ba thao tác từ tab chính.
- Các thao tác ghi luôn có trạng thái đang gửi, thành công, thất bại và khả năng thử lại phù hợp.
