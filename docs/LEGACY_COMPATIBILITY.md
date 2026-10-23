# Mã tương thích cũ — không phải luồng Web

Sản phẩm đang hoạt động là CH Hair Web trên Firebase. Khách dùng Phone Auth; chủ salon và
nhân viên dùng Email/Password. Không phát triển lại Zalo Mini App, tester invitation hoặc review.

## Vì sao GitHub vẫn còn một số tên Zalo?

| Nhóm | Lý do giữ |
| --- | --- |
| firebase/functions/src/zalo*.ts và các callable *FromZalo | Vẫn được backend export/import; xóa nguồn có thể làm thay đổi danh sách Functions lúc deploy. |
| services/zalo-verification-gateway, scripts/zalo-gateway, deploy/zalo-gateway | Source/công cụ của dịch vụ cũ, không phải dependency đăng nhập Web. Dọn repo không đồng nghĩa được phép tắt service hoặc tunnel đã cài. |
| zaloUserId, identityProvider và tên endpoint trong contracts | Tương thích schema/dữ liệu cũ; không được đổi tên field chỉ để không thấy từ Zalo. Khách Web vẫn được xác định bằng UID Firebase. |
| Tests và fixture legacy | Kiểm tra tương thích hoặc bảo đảm frontend không vô tình dùng lại luồng cũ. |
| docs/archive và báo cáo kiểm thử có ngày/SHA | Bằng chứng lịch sử, không phải hướng dẫn triển khai hiện tại. |

Không đổi tên API Zalo thành API Web nếu chức năng thật vẫn xác minh Zalo. Việc đó chỉ che tên
và có thể làm hỏng caller cũ. Không đổi ID khách, gộp hồ sơ hoặc xóa secret/dữ liệu để dọn source.

## Những phần đã dọn khỏi luồng Web

Tên hằng branding dùng APP_NAME/APP_MARK; script phát triển là scripts/start-web.ps1.
Meta xác minh domain Zalo, CSS profile Zalo không được sử dụng và các nhánh xử lý lỗi/callable
Zalo trong Firebase client Web đã gỡ. Điều khoản, hướng dẫn Firebase, kiến trúc, sản phẩm và
template GitHub mô tả luồng Web. Tên thương hiệu hiển thị CH Haircut Salon và địa chỉ repo không đổi.

Hướng dẫn Gateway cũ nằm tại [archive](archive/ZALO_GATEWAY_PRE_VPS.md).
Mã/tài liệu bị gỡ vẫn khôi phục được từ lịch sử Git; không rewrite lịch sử.

## Muốn gỡ backend/Gateway hoàn toàn

Cần một thay đổi vận hành riêng: kiểm tra caller và dữ liệu cũ, lập danh sách Functions/secrets/
service/tunnel cụ thể, chuẩn bị khôi phục rồi xin phê duyệt tắt từng tài nguyên. Chưa thực hiện
các bước đó trong lần dọn tên này; không tuyên bố repo đã xóa mọi dòng có chữ Zalo.
