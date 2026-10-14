# Trung tâm quản trị salon

Ứng dụng riêng tại `apps/admin-web`, tách khỏi website khách. Đã phát hành tại
https://haircut-c7d12-admin.web.app ngày 2026-10-14. Xem bằng chứng và giới hạn hậu kiểm
trong [ADMIN_RELEASE_STATUS.md](ADMIN_RELEASE_STATUS.md).

## Phạm vi

- Tổng quan hệ thống; danh sách salon có phân trang và bộ lọc trên dữ liệu đã tải.
- Chọn một salon để đối chiếu bộ đếm khách, hồ sơ chủ salon, chi nhánh hoạt động,
  cờ tính năng và tối đa 50 liên kết lượt đang được giữ.
- Hai thao tác sửa có giới hạn: đồng bộ `salons.customerCount` từ hồ sơ thực tế; gỡ
  liên kết tới lượt đã đóng/không tồn tại nếu không còn yêu cầu điểm đang chờ.
- Mỗi thao tác yêu cầu đúng tên salon, lý do, xác nhận rõ ràng, đăng nhập trong 10 phút
  gần nhất, khóa chống gửi lặp và ghi audit cùng transaction.
- Không sửa điểm, quà, lịch sử hoặc cooldown; không xóa salon, tự mở khóa tài khoản,
  thay gói dịch vụ, chạy lệnh hoặc sửa mã nguồn từ giao diện.

Nếu có hơn 50 liên kết, giao diện ghi rõ kết quả chỉ là một phần, không khẳng định salon
hoàn toàn bình thường. Lỗi không có trong bộ quy tắc phải được điều tra riêng.

## Quyền và bảo vệ

- Backend xác minh `users/{uid}` với role `system_admin`, hoặc grant riêng
  `system_admin_access/{uid}` có `role: system_admin` và `isActive: true`.
- Grant riêng giữ nguyên hồ sơ `owner` đang dùng. Không dùng email phía client để cấp quyền.
- Client không được đọc/ghi sổ quyền hoặc biên nhận sửa; Rules hiện có mặc định từ chối.
  Chỉ operator đã được chủ dự án chỉ định và xác minh danh tính mới được cấp grant.
- `ADMIN_SUPPORT_REPAIRS_ENABLED=true` chỉ mở hai thao tác mới. Mặc định là tắt.
  **Không bật** `ADMIN_WRITE_OPERATIONS_ENABLED`; các thao tác quản trị cũ vẫn bị khóa.
- Cờ repair phải được kiểm tra trên cả ba API mới (access, diagnostics, repair) sau mỗi
  lần phát hành. Thay env chỉ cập nhật đúng `serviceConfig.environmentVariables`, giữ
  nguyên mọi giá trị khác; không sửa App Check enforcement hoặc các API nghiệp vụ khách.
- Diagnostic giới hạn 20 lần/phút, repair 6 lần/phút cho mỗi tài khoản; không quét tự động
  tất cả salon trong nền. API mới giới hạn tối đa 3 instances.
- Counter được đối chiếu trong transaction; bản xem trước lỗi thời bị từ chối. Không có
  thao tác ghi trực tiếp Firestore từ trình duyệt.

## Sự cố hạ tầng

Mục Sự cố dẫn tới Billing, Logs và chỉ mục của đúng project Google. Chỉ mở công cụ,
không tự thanh toán, tạo chỉ mục, đổi quyền hay bật/tắt dịch vụ. HTTP lỗi không được
hiển thị như dữ liệu rỗng hoặc số 0.

## Phát hành riêng

1. Kiểm thử, coverage, Rules/emulator, trình duyệt và CI phải PASS.
2. `node scripts/build-admin-hosting.mjs` lấy duy nhất các trường Firebase Web công khai
   từ cấu hình Admin, hoặc tái dùng cấu hình public của Customer Web cùng project.
   Không sao chép file dotenv, không nhận debug token production, không in credential.
3. Chỉ dùng `firebase.admin.json` tại root repo cho site Admin. Firebase yêu cầu thư mục
   artifact nằm trong project root (thư mục chứa config). Không thay site khách
   `haircut-c7d12`, không copy vào `firebase/public`.
4. API mới: `getSystemAdminAccess`, `getSystemAdminSalonDiagnostics`, `repairSystemAdminSalon`.
   Bốn API Admin đọc hiện có cần được cập nhật để nhận grant riêng: `getSystemAdminOverview`,
   `listSystemAdminSalons`, `getSystemFeatureFlags`, `listSystemAdminAuditEvents`.
   Không deploy lại API nghiệp vụ khách hoặc các API quản trị ghi cũ.
5. Thêm đúng hostname Admin đã được duyệt vào danh sách domain của khóa reCAPTCHA hiện có;
   giữ mọi domain cũ, không tắt domain verification hoặc thay enforcement.
6. Cấp grant riêng cho đúng Firebase UID của email đã được người dùng chỉ định, sau khi
   xác minh account/email và giữ nguyên hồ sơ chủ salon. Không tạo mật khẩu hoặc token giả danh.
7. Hậu kiểm bằng đăng nhập của operator; kiểm tra đọc dữ liệu và fail-closed. Không thực hiện
   một repair thật trên dữ liệu khách chỉ để lấy bằng chứng PASS.

## Rollback

Lệnh Hosting riêng, chạy từ root repo sau khi CI PASS và đã đóng gói:

```powershell
firebase deploy --project haircut-c7d12 --config firebase.admin.json --only hosting:haircut-c7d12-admin --non-interactive
```

Trên Windows, trước khi phát hành đúng danh sách 7 API Admin ở trên, chạy
`npm --prefix firebase/functions run sync:contracts` để đồng nhất bản sao generated (kể cả
CRLF/LF); xác minh `git diff --exit-code` không có thay đổi nội dung. Dùng
`$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"` như script phát hành hiện có để tránh timeout
nhận diện code trên laptop. Không bỏ qua predeploy build hoặc mở rộng danh sách API.

Tắt cờ repair mới hoặc vô hiệu hóa grant riêng để đóng khả năng sửa; không thay hồ sơ owner.
Hosting Admin có thể trả về release trước. API Admin đọc có thể triển khai lại source trước
đợt này; website khách, điểm/quà và dữ liệu lịch sử không bị thay đổi bởi phát hành Admin.

Xem [bằng chứng kiểm thử](testing/admin-operations-center.tdd.md).
