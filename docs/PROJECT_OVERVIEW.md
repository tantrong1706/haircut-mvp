# CH Hair — tổng hợp dự án và đợt hoàn thiện Admin

Đối chiếu source ngày 06/11/2026 (Asia/Saigon). Sản phẩm hoạt động là **Web trên Firebase**.
Đây là bản đồ vận hành, không phải chứng nhận không còn lỗi hoặc xác nhận mọi thay đổi đã deploy.

## Các phần của dự án

| Phần              | Vai trò và ranh giới                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Customer Web      | Quét QR chi nhánh, Phone OTP, nhớ phiên hợp lệ, yêu cầu điểm, lịch sử ngày cắt, vòng quay và quà        |
| Chủ salon         | Danh bạ, yêu cầu điểm, ảnh/ghi chú nội bộ, chi nhánh/QR, nhân viên, cấu hình và quà                     |
| Nhân viên         | Đăng nhập chung với chủ; chỉ làm việc theo quyền/chi nhánh được phân công, không xóa salon              |
| Admin hệ thống    | Hosting và quyền riêng; xem toàn hệ thống, đối chiếu từng salon, sửa lỗi có giới hạn, truy vết thao tác |
| Functions         | Xác thực và phân quyền phía server; QR ký, giao dịch điểm/quà, chống trùng và cooldown                  |
| Firestore/Storage | Hồ sơ theo salon, ảnh nội bộ theo quyền và sự đồng ý; client không được tự ghi điểm hoặc quyền Admin    |
| Manager           | Source/adapters dùng chung cho Web bundle; native không thuộc đợt này                                   |
| CI                | Build Web, CodeQL; Lighthouse trên PR/manual. CI xanh không tự deploy production                        |

Luồng chính: QR xác định chi nhánh → xác thực lần đầu → khách gửi yêu cầu → thợ/chủ xác nhận
→ cộng đúng một lần → cooldown ngầm hai giờ. Không gộp danh tính khách, đổi quyền hoặc thay
giao dịch nghiệp vụ trong đợt làm Admin.

## Phân biệt source và bản thật

- `main` trước đợt Admin: `b5be74886e68119d66c97cdf5eb98c29b2f9303f`.
- Customer Hosting gần nhất đã đối chiếu: `86906d689d90731c`, source `8667226`.
- API Web bảo trì gần nhất: source `12132a0`; không deploy lại cùng đợt tài liệu #86.
- Admin live được ghi nhận ở [biên bản riêng](ADMIN_RELEASE_STATUS.md): source `4c30ce1`, ngày 14/10.
- Admin mới nằm trong PR #79, **chưa merge/deploy**. Cần đọc CI theo đúng PR head; kết quả
  của main hoặc PR cũ không thay thế kết quả của source mới.

## Vấn đề đã xác minh và xử lý trong source Admin

| Vấn đề                                                           | Thay đổi và giới hạn                                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Nhật ký salon bị mất bản ghi khi salon khác có nhiều sự kiện mới | Lọc salon tại truy vấn trước khi giới hạn số bản ghi; test tái hiện bằng dữ liệu emulator                      |
| Tổng quan thiếu salon chờ xóa, gộp chủ/thợ gây khó quan sát      | Hiện tám chỉ số riêng, không gọi số hồ sơ là số người online                                                   |
| Số yêu cầu trạng thái pending dễ bị hiểu là tất cả còn hiệu lực  | Ghi rõ gồm cả bản ghi hết hạn chưa đóng; hàng đợi từng salon phân biệt còn hạn/hết hạn/không khớp/chưa rõ hạn  |
| Chưa có công cụ khóa/mở và hủy yêu cầu theo phạm vi xác nhận     | Thêm ba hành động có giới hạn; mặc định khóa bằng cờ server riêng, không mở các Admin writes cũ                |
| Rủi ro nhầm salon, gửi lại hoặc phản hồi cũ ghi đè giao diện     | Kiểm tra salon phía server và client, transaction, biên nhận chống trùng, xác nhận tên/lý do, loại phản hồi cũ |
| Thông báo lỗi khó phân biệt với hệ thống trống                   | Giữ trạng thái chưa tải/lỗi riêng; không hiện số 0 hoặc thông báo khỏe giả khi API lỗi                         |

Không có nút thực thi lệnh, tự sửa mọi lỗi, thanh toán Google, xóa vĩnh viễn, sửa điểm/quà
hoặc đổi quyền tài khoản. Hủy yêu cầu không xóa ảnh, hồ sơ hay lịch sử. Những lỗi Billing,
IAM, chỉ mục hoặc lỗi mã nguồn vẫn phải xử lý đúng công cụ, không chữa bằng xóa dữ liệu.

## Bố cục Admin mới

- **Tổng quan:** salon, trạng thái, hồ sơ chủ/thợ, yêu cầu chờ và lượt mở; tình trạng tải từng dịch vụ.
- **Salon:** danh sách có tìm/lọc/phân trang; kết quả đối chiếu; mở yêu cầu chờ và quản lý đúng salon.
- **Cấu hình:** đối chiếu các cờ hiện tại, chỉ đọc.
- **Nhật ký:** lọc theo salon trên server, hiện tối đa 50 sự kiện gần nhất của phạm vi đã chọn.
- **Sự cố:** hướng xử lý theo loại lỗi và đường dẫn công cụ đúng project; không tự đổi hạ tầng.

Không tự quét mọi salon hoặc polling liên tục. Hàng đợi tải tối đa 50 dòng mỗi trang, luôn ghi
phạm vi đã tải; không suy ra số lỗi toàn hệ thống từ một trang dữ liệu.

## Bằng chứng và phần chưa thể khẳng định

Trong đợt triển khai source này đã chạy: Admin 94 unit/component test; Admin browser 21 ca
trên desktop Chromium, mobile Chromium và mobile WebKit, gồm axe; Admin backend emulator 62 ca;
Functions typecheck/lint/format và 119 unit test. Các nhóm trên đều PASS trước lượt kiểm tra
toàn repository cuối. Coverage và TDD tại [bằng chứng Admin](testing/admin-operations-center.tdd.md).
Biên bản full suite và CI cuối được ghi trong PR #79 theo đúng SHA sau khi thực thi, không
tự suy ra từ bảng kết quả này.

Runtime dependency audit cả bốn workspace ngày 06/11: 0 advisory. Không coi dev tooling,
mọi revision cũ đã deploy hoặc các dịch vụ ngoài phạm vi là đã hết lỗ hổng.

Các giới hạn còn giữ rõ:

- Chưa nghiệm thu Admin mới bằng đăng nhập operator trên production vì chưa được phép phát hành.
- OTP/camera/lượt cắt trên điện thoại thật của release khách hiện tại chưa được chạy lại đầy đủ;
  các test tự động dùng fixture/emulator, không gửi SMS hoặc đổi điểm khách thật.
- App Check enforcement, Sentry/optional monitoring vẫn giữ policy hiện có; Admin không có
  nguồn log toàn bộ lỗi frontend tự động chỉ nhờ một màn hình tổng quan.
- API/index live cần được hậu kiểm khi có quyền phát hành. Emulator không chứng minh chỉ mục
  production đã sẵn sàng; lỗi chỉ mục phải hiện lỗi, không biến thành hàng đợi rỗng.
- Không tự merge các PR Auth, gói dịch vụ hoặc nâng dependency khác vào đợt này.

Đánh giá kỹ thuật từ bằng chứng hiện có: **84/100, có thể tiếp tục kiểm thử có kiểm soát**;
không dùng điểm này để thay quyền merge/deploy hoặc nghiệm thu thiết bị thật.

## Bước phát hành tiếp theo cần phê duyệt riêng

Hiện chỉ được cập nhật PR #79 và chạy CI sau khi local PASS. Nếu sau đó được duyệt phát hành:
chỉ Admin Hosting, hai API mới và API nhật ký cần sửa; kiểm tra cờ khả năng trên cả API đọc/ghi,
giữ các Admin writes cũ khóa. Không deploy Customer Hosting, API nghiệp vụ khách, Rules/IAM,
đổi App Check hoặc thử hủy/khóa salon thật chỉ để lấy PASS.

Xem [hướng dẫn Admin](ADMIN_OPERATIONS.md), [trạng thái Web](RELEASE_STATUS.md) và
[xử lý sự cố](incident-runbook.md).
