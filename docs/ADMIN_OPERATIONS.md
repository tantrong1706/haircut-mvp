# Trung tâm quản trị salon

Ứng dụng riêng tại `apps/admin-web`, tách khỏi website khách. Đã phát hành tại
https://haircut-c7d12-admin.web.app; bản Admin mới đã phát hành ngày 06/11/2026. Xem bằng chứng và giới hạn hậu kiểm
trong [ADMIN_RELEASE_STATUS.md](ADMIN_RELEASE_STATUS.md).

## Bổ sung đã phát hành 06/11/2026 — PR #79 và #87

Chủ dự án đã chốt thêm **khóa/mở salon và hủy yêu cầu đang chờ**, không xóa vĩnh viễn.
Sau kiểm thử/CI, chủ dự án đã cho phép main + Admin Hosting + đúng ba API và bật các thao tác
đã chốt. Đã hậu kiểm đăng nhập thật ở chế độ chỉ đọc/xem trước, không khóa/hủy salon thật.
Source/version đang phục vụ và các giới hạn test được ghi tại `ADMIN_RELEASE_STATUS.md`.

- Tổng quan có tám chỉ số; chỉ số pending gồm cả yêu cầu hết hạn chưa được đóng.
- Trong Salon → chọn salon → “Yêu cầu chờ và quản lý salon”, API đọc trả tối đa 50 yêu cầu
  mỗi trang, không kèm điện thoại/tên khách, ảnh, ghi chú hoặc token. Phân biệt hết hạn và
  dữ liệu không nhất quán; dữ liệu không khớp không được hủy.
- `getSystemAdminSalonOperations` chỉ đọc; `manageSystemAdminSalon` chỉ chấp nhận
  `suspend_salon`, `reactivate_salon`, `cancel_point_request`.
- `ADMIN_SUPERVISION_WRITES_ENABLED=true` là cờ riêng **mặc định tắt**. Cần xác minh cờ
  đồng nhất trên cả hai API mới nếu sau này được phép bật. Không dùng hoặc bật
  `ADMIN_WRITE_OPERATIONS_ENABLED`; không đổi cờ hai repair cũ.
- Mọi thay đổi cần đăng nhập trong mười phút gần nhất, nhập đúng tên salon, lý do 10–300
  ký tự, xác nhận rõ ràng và mã thao tác chống trùng. API kiểm tra lại grant trong transaction;
  audit và biên nhận `admin_supervision_operations` được ghi cùng thay đổi.
- Khóa salon chỉ đổi trạng thái vận hành, giữ tài khoản và dữ liệu. Mở lại không cấp quyền
  hoặc khôi phục yêu cầu cũ. Không thao tác salon đang chờ xóa.
- Hủy chỉ áp dụng yêu cầu pending gắn đúng lượt pending_approval đang mở cùng salon/chi nhánh/
  khách. Transaction đánh dấu yêu cầu rejected và lượt cancelled; chỉ gỡ pointer nếu còn
  trỏ chính xác lượt đó. Không cộng/trừ điểm, xóa ảnh/ghi chú, hồ sơ, quà hoặc lịch sử.
- Hủy yêu cầu không có nút hoàn tác. Nếu khách cần tạo lượt mới, dùng lại luồng Web thông thường
  và mọi điều kiện hiện có; không khôi phục yêu cầu hoặc bỏ cooldown để chữa lỗi.
- Nhật ký lọc salon **trước** giới hạn trên server, dùng index salonId/createdAt đã có trong
  source. Hiện tối đa 50 bản ghi gần nhất, không khẳng định đã hiển thị toàn bộ lịch sử.

Hai API mới giới hạn 3 instances, dùng lại giới hạn đọc/sửa Admin (20/6 lần mỗi phút).
Không quét nền hoặc tải tất cả hồ sơ khách. Lỗi mạng/thiếu endpoint/thiếu index phải hiện rõ,
không giả số 0. Không in payload cấu hình hay token ra báo cáo.

Đợt phát hành chỉ gồm Admin Hosting và ba API
`getSystemAdminSalonOperations`, `manageSystemAdminSalon`, `listSystemAdminAuditEvents`.
Cần hậu kiểm read-only và khả năng fail-closed bằng tài khoản operator; không khóa/hủy salon
thật để thử. Các đợt thay đổi/phát hành tiếp theo vẫn cần phê duyệt phạm vi riêng.
Rollback khả năng ghi mới bằng tắt cờ trên hai API mới, giữ các cờ repair cũ và grant owner;
không xóa biên nhận/audit. Có thể trả Hosting Admin về release trước, không thay website khách.

Query queue dùng các điều kiện equality và thứ tự document ID; tham khảo
[Firestore index merging](https://firebase.google.com/docs/firestore/query-data/index-overview#use_index_merging).
Không coi test emulator là bằng chứng chỉ mục live đã được kiểm tra.

Xem [tổng hợp dự án](PROJECT_OVERVIEW.md) và [TDD](testing/admin-operations-center.tdd.md).

## Phạm vi đã phát hành 14/10

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
