# Kiến trúc CH Hair Web

    Khách -> Customer Web -> Firebase Phone Auth -> Web callables
    Chủ salon/Nhân viên -> /owner, /staff -> Firebase Email/Password -> callables phân quyền
    Quản trị hệ thống -> Admin Web riêng -> quyền quản trị riêng -> Admin callables
                                                   |
                              Firestore + Storage + audit/monitoring

## Phân tách ứng dụng

- customer-web/: Web/PWA khách, trang Chủ salon và Nhân viên; QR xác định chi nhánh.
- apps/admin-web/: cổng quản trị riêng; không tự cấp quyền quản trị từ tài khoản chủ salon.
- apps/manager-mobile/: source Manager còn được kiểm tra Web và dùng adapter chung. Phát hành
  iOS/Android không nằm trong luồng vận hành hiện tại.
- packages/client-domain/: kiểu dữ liệu và tiện ích thuần dùng chung.
- packages/contracts/: schema, trạng thái, lỗi và tên callable. Mirror trong Functions được
  kiểm tra trước build để Cloud Build không phụ thuộc file ngoài gói nguồn.

## Danh tính và tenant

Khách Web dùng Firebase UID có Phone provider đã xác minh; server dẫn xuất customer ID theo salon.
Không xác thực khách bằng customer ID trong URL/cache hoặc bằng 4 số cuối điện thoại.

Owner/staff được kiểm tra Firebase Auth, users/{uid}, role, isActive, salon và chi nhánh được giao.
Các query và transaction phải giữ salonId/branchId phù hợp; client không tự chọn số điểm hay
quyền truy cập. Quản trị hệ thống có grant riêng, không thay quyền chủ salon.

## Luồng điểm và QR

QR chi nhánh có chữ ký. Khách gửi yêu cầu, nhân viên đúng chi nhánh xác nhận; không bắt buộc thêm
bước nhận khách rồi chờ chủ duyệt trong luồng Web này. Session/request có định danh và transaction
chống gửi lặp. Sau khi cộng điểm, cooldown hai giờ áp dụng theo khách/salon; UI không hiện đồng hồ.

Danh bạ chủ salon có phân trang/tổng số khách. Tích điểm khách quen cần chọn đúng khách, xác nhận
chi nhánh và gửi operation ID ổn định. Trùng 4 số cuối không tự gộp người; giới hạn và quyền được
kiểm tra ở backend. Điểm, lịch sử, vòng quay và đổi quà vẫn do server quyết định.

## Ảnh và ghi chú

Ảnh/ghi chú lưu trước xác nhận điểm. Khách phải đồng ý lưu ảnh; ảnh không bắt buộc để cộng điểm.
API cấp operation upload JPEG tối đa 3 MiB, giới hạn staging năm phút và kiểm tra lại quyền/
consent lúc finalize. Storage Rules chỉ đọc hai document để kiểm tra grant và consent hiện hành.

Backend kiểm tra byte ảnh, thu hồi token tải dài hạn của object được xử lý và cấp link xem có
chữ ký tối đa 15 phút. Client không được đọc metadata/media trực tiếp để tạo lại link dài hạn.
Đây không phải thu hồi hàng loạt mọi link cũ hoặc thu hồi bản ảnh đã tải về.

## Phiên, vận hành và tương thích

Firebase SDK giữ phiên trên cùng trình duyệt; phiên khách tách khỏi phiên quản lý.
Đăng xuất, xóa site data, trình duyệt riêng tư hoặc đổi thiết bị có thể cần đăng nhập lại.
App Check và feature flags không được thay đổi để ép test thành công.
Monitoring không ghi token, số điện thoại đầy đủ, nội dung ghi chú hoặc URL ảnh riêng tư.

Adapter/field cũ còn giữ không phải luồng Web: xem [ranh giới tương thích](LEGACY_COMPATIBILITY.md).
Không đổi ID khách hoặc xóa backend/service cũ chỉ vì tên chứa nền tảng trước đây.

Xem [API](API_CONTRACTS.md), [dữ liệu](DATABASE.md), [triển khai](deployment.md)
và [trạng thái phát hành](RELEASE_STATUS.md).
