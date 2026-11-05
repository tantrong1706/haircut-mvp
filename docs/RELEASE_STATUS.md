# Trạng thái CH Hair Web

Cập nhật đối chiếu 05/11/2026 (Asia/Saigon). Sản phẩm là Web trên Firebase tại
https://app.chhaircutsalon.cc. Source trên GitHub và bản đang phục vụ được ghi riêng bên dưới.

## Production đã xác minh ngày 05/11

| Phần                            | Source đã phát hành                                      | Trạng thái đã đối chiếu                                                     |
| ------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Customer Web                    | `8667226049f60f6d583adb00468e7b5bc4beb54f`, merge PR #85 | Hosting `86906d689d90731c`, site `haircut-c7d12`                            |
| API Web                         | `12132a056491adfd72613dbe97a87c71a7f03060`               | 57 callable được phát hành, 54 cập nhật và 3 mới; tất cả ACTIVE, Node.js 22 |
| Ngoài phạm vi đợt giao diện #85 | Không deploy lại                                         | 86 Functions giữ nguyên inventory, state và updateTime trước/sau Hosting    |

Ba API mới đã có trên production: `updateSalonCustomerName`, `updateWebCustomerName` và
`withdrawWebCustomerPhotoConsent`. Không dùng nhận định vắng API ở phần chuẩn bị 04/11 bên dưới
để mô tả trạng thái hiện tại.

### Các phần đã phát hành

- Khách tự đổi tên trong Tài khoản; chủ sửa tên trong danh bạ; thợ sửa tên khi xử lý yêu cầu
  đang chờ đúng phạm vi được phân công. Không đổi SĐT, điểm hoặc viết lại lượt đã hoàn tất.
- Yêu cầu tích điểm Web mới chờ xác nhận tối đa 2 giờ; cooldown sau cộng điểm vẫn 2 giờ ngầm.
  Không tự duyệt, không cộng lặp hoặc khôi phục yêu cầu cũ đã hết hạn.
- Ảnh/ghi chú là hồ sơ nội bộ của chủ salon và thợ được phân công cùng chi nhánh; khách xem
  ngày cắt và điểm, không xem ảnh/ghi chú nội bộ. Có luồng bổ sung lượt gần nhất sau cộng điểm
  theo quyền và điều kiện của API; không tạo thêm lượt hoặc cộng thêm điểm để bổ sung ảnh.
- Nhãn check-in: “Cho phép salon chụp và lưu ảnh”; checkbox vẫn do khách tự chọn và giới hạn
  upload server không đổi. Bỏ số lượng/câu không bắt buộc khỏi nhãn không phải bỏ kiểm tra quyền ảnh.
- Bảng quyền riêng tư mặc định đóng; chỉ mở khi bấm cài đặt. Cài đặt quyền riêng tư và Quyền
  dữ liệu ở chân trang, tránh thanh điều hướng khách; hai nút lựa chọn đã sửa tương phản.
- Không tự bật thống kê khi chưa đồng ý; lựa chọn chỉ thiết yếu không xóa phiên đăng nhập.
  Firebase Auth vẫn nhớ khách trên cùng trình duyệt/origin khi phiên hợp lệ, không bảo đảm
  OTP một lần vĩnh viễn sau logout, xóa dữ liệu, đổi trình duyệt/thiết bị hoặc thu hồi phiên.
- Kênh hỗ trợ công khai chỉ là email đã được duyệt. Các trang chính sách/quyền dữ liệu mở
  độc lập, không bắt khách có tài khoản quản lý.

### Bằng chứng và ranh giới kiểm tra

- PR #85: 9/9 checks PASS; Build Web và CodeQL trên merge SHA PASS. Lighthouse PASS trên PR,
  không gọi đó là workflow push-main vì Lighthouse chỉ chạy PR/manual.
- Full suite trên đúng merge SHA: 19/19 bước bắt buộc PASS; Web 374, Functions unit 119,
  Rules 35, integration 219, browser 78, Admin 42, Manager 87 và repository 154 test PASS.
- Nhóm privacy: 39 test PASS; coverage 100% lines/statements/functions, 96.77% branches.
- HTTPS/HTML của 12 route và 11 entry assets trùng bản đóng gói. Chunk check-in đã triển khai
  chứa nhãn ảnh mới. Browser 360px/1440px xác minh chân trang, mở/đóng bảng và axe footer PASS;
  không ghi nhận console/page error, request failure hoặc request theo dõi tùy chọn trước opt-in
  trong phiên thử đó.
- Runtime audit cả 4 workspace: 0 advisory tại thời điểm kiểm tra. Dev-tool warnings/advisories
  không được xem là đã hết; không dùng kết quả này để cam kết không còn lỗ hổng.
- Đợt bảo trì API trước đó giữ nguyên biến nghiệp vụ/secret binding/service account. Nền tảng
  chỉ làm rõ default `FUNCTION_SIGNATURE_TYPE=http` ở hai HTTP callable; đã đối chiếu riêng.
- Đợt #85 chỉ deploy Customer Hosting. Không deploy Functions, Admin, Rules, indexes,
  native hoặc Zalo; không sửa IAM, App Check hay dữ liệu khách để lấy kết quả PASS.

Biên bản đã thực thi: [PR #85 và release receipt](https://github.com/tantrong1706/haircut-mvp/pull/85#issuecomment-6663548888).
Hosting trước đợt giao diện: `5999d1bf15e67ff9`; source/config Functions trước bảo trì được
lưu ngoài Git, hạn chế quyền, có checksum. Không commit hoặc in payload cấu hình bí mật.

Các test đăng nhập trình duyệt trong đợt này dùng fixture/emulator. OTP thật trên điện thoại
vật lý và lượt cắt đã đăng nhập chưa được chạy lại trong release #85; không đánh dấu PASS
cho phần đó từ test tự động hoặc HTTP 200. Bằng chứng điện thoại trước đây có ngày riêng.
Commit tài liệu sau merge SHA trên có thể chưa deploy; không đổi source/version live chỉ vì
main có thêm tài liệu. Các phần sau là lịch sử, không phải trạng thái production hiện tại.

## Lịch sử: chuẩn bị 04/11 — đã được các đợt 05/11 thay thế

Mốc mã tính năng: PR #83 đã nhập `main` ngày 04/11, merge SHA
`660a8655f8c46a62b868bae8fb6c846dc6bb795d`. Cả 9 kiểm tra PR và các workflow Build Web,
CodeQL, Lighthouse trên merge SHA đều PASS. Đây là trạng thái source, **chưa deploy Firebase**.
Các commit kiểm thử/tài liệu sau đó không được hiểu là phiên bản website đã đổi.

Đối chiếu API ngày 04/11: ba API mới `updateSalonCustomerName`, `updateWebCustomerName` và
`withdrawWebCustomerPhotoConsent` chưa có trong danh sách Functions production. Có mã hoặc
kiểm thử local PASS chưa có nghĩa website thật đã có nút/chức năng mới. Phát hành vẫn cần
proof trên đúng SHA main và kiểm tra vận hành đã duyệt; không tự bỏ qua kiểm tra.

Đợt này còn gồm khách tự đổi tên ở Tài khoản, guard salon bị tắt và thời gian chờ xác nhận
Web mới 2 giờ. Không tự duyệt/cộng điểm, không đổi cooldown, không khôi phục yêu cầu đã hết hạn.
Hồ sơ khách có thể xuất hiện trong danh bạ trước lần tích điểm đầu tiên; danh bạ không phải
danh sách lượt đã được duyệt. Mục Duyệt điểm chỉ hiển thị yêu cầu còn trạng thái chờ.

Nhánh `codex/web-release-readiness`: quyền riêng tư/email-only, tên khách có phân quyền,
thư viện runtime đã vá và cổng phát hành bảo trì đúng phạm vi. Bằng chứng local mới tại
[web-release-readiness.tdd.md](testing/web-release-readiness.tdd.md).
Chủ dự án đã duyệt main + Customer Hosting + 57 callable Web sau full-suite/CI PASS trên đúng SHA.
Không deploy Admin/Zalo/native/Rules/IAM/TTL hoặc đổi App Check. Chưa lấy kết quả local làm
bằng chứng website thật đã nhận bản sửa; biên bản production bên dưới vẫn là lần 22/10.

## Lịch sử: bằng chứng phát hành 22/10

Thông tin bên dưới là biên bản phát hành ngày 22/10, không phải đối chiếu live ngày 30/10.
Source mới hoặc CI PASS không tự chứng minh production đã nhận bản đó.

- Source đã deploy: 5435256bec2be8284215836c7a4c56aa4ff3e32b, merge PR #74.
- Hosting version: abd70bd7cb0765fe (site haircut-c7d12).
- 11 API Web/ảnh/khách quen đã phát hành và xác minh ACTIVE, runtime Node.js 22.
- Storage Rules mới đã phát hành và đối chiếu trùng source.
- Không deploy Admin, Zalo, Firestore Rules hoặc indexes. App Check enforcement không đổi.
- Bản sao lưu 9 Functions cũ, cấu hình và Rules được giữ ngoài repository ở nơi hạn chế quyền.
  Hosting trước đợt này: eab0acb4bfd1081a. Không commit các bản sao lưu có cấu hình riêng.

Các API được phát hành:

resolveCustomerQr, getWebCustomerContext, checkInWebCustomer, getHaircutPhotoReadUrls,
beginHaircutPhotoUpload, finalizeHaircutPhotoUpload, awardReturningCustomerPoints,
updatePendingPointRequestPhotos, getWebCustomerHistory, searchSalonCustomers,
getSalonCustomerDetails.

## Bằng chứng của lần phát hành 22/10

- CI của merge SHA: Build Web và CodeQL PASS.
- Chạy lại local: 119/119 backend unit; 256/256 Web tests, lint/format/build PASS.
- Domain chính trả HTTPS 200 và HTML trùng artifact trên /, /owner, /staff, /history, /wheel.
- Hai API mới từ chối request chưa đăng nhập bằng 401 UNAUTHENTICATED.
- Kiểm tra live bằng salon/tài khoản/khách giả: danh bạ, tổng số khách, tìm trùng 4 số cuối,
  lưu ghi chú, upload JPEG 2×2, finalize, xem link ký, chặn đọc trực tiếp và thu hồi token dài hạn PASS.
- Consent thu hồi chặn URL ảnh mới; note-only không trả URL ảnh. Ảnh và ghi chú có trong lịch sử
  sau xác nhận; cộng đúng một điểm. Gửi lặp/cooldown không cộng thêm.
- Chủ salon và Nhân viên đóng/mở lại browser profile riêng vẫn giữ đăng nhập.
- Giao diện bản thật kiểm tra ở viewport 360px và 1440px: không tràn ngang; không ghi nhận
  page error hoặc HTTP error trong phiên thử đó.
- Ba request mở cùng QR chi nhánh giả đồng thời PASS; QR sai bị từ chối.
- Toàn bộ dữ liệu/tài khoản/ảnh giả và browser profile đã dọn, không đụng dữ liệu khách thật.

Lần chuẩn bị canary đầu thất bại do công cụ thử thiếu quota-project header khi dùng OAuth;
dữ liệu giả của lần đó cũng đã dọn. Không thay quyền Auth hay cấu hình app để ép PASS.

## Lịch sử: source cleanup trước đợt phát hành 05/11

Bản dọn tên và tài liệu Web đổi hằng branding APP_NAME/APP_MARK, script start-web, gỡ meta/CSS/
nhánh thông báo Zalo thừa và cập nhật hướng dẫn. Chủ dự án chỉ cho phép nhập main khi CI PASS,
không cho deploy trong chính đợt dọn đó. Ở thời điểm ghi biên bản cũ, website chạy source
PR #74; trạng thái hiện tại nằm ở mục production 05/11 đầu tài liệu.

Đổi source không xóa Functions/secrets/Gateway đã triển khai và không đổi ID khách.
Xem [ranh giới tương thích](LEGACY_COMPATIBILITY.md) và [bằng chứng dọn tên](testing/web-naming-cleanup.tdd.md).

## Ghi chú và giới hạn của các biên bản lịch sử

- Bản chuẩn bị `codex/privacy-readiness` ngày 30/10 chưa được merge/deploy. Không thay số liệu
  phát hành 22/10 bằng kết quả local; xem [checklist quyền riêng tư](PRIVACY_CHECKLIST.md).

- Browser viewport không thay thế kiểm thử iPhone/Android vật lý. Không gửi OTP thật trong
  canary 22/10; bằng chứng OTP thực trước đây nằm trong WEB_CUSTOMER_RELEASE_READINESS.md.
- Giới hạn cũ chỉ lưu ảnh/ghi chú trước xác nhận đã được thay thế: bản hiện tại có luồng bổ
  sung lượt gần nhất theo điều kiện API; xem phạm vi production 05/11 ở trên.
- Không thu hồi hàng loạt link ảnh khách cũ; link ký tối đa 15 phút không thu hồi bản đã tải về.
- Storage Rules compile/deploy thành công, còn cảnh báo helper cũ không được gọi.
- Đây là bằng chứng của release cụ thể, không cam kết ứng dụng không còn lỗi hoặc bảo mật tuyệt đối.
- Các báo cáo audit và số lượng cảnh báo dependency cũ có ngày riêng; không xem là kết quả hiện tại.

Báo cáo trước ngày 22/10 còn trong lịch sử Git; không xóa lịch sử release hoặc bản sao lưu.
