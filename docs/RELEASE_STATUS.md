# Trạng thái CH Hair Web

Cập nhật ngày 27/10/2026 (Asia/Saigon). Website khách và cổng chủ salon/nhân viên dùng Web trên
Firebase tại https://app.chhaircutsalon.cc. Mã nguồn đã nhập main không tự đồng nghĩa đã phát hành;
các phiên bản đang phục vụ được ghi riêng dưới đây.

## Bản đang phục vụ

| Thành phần                                 | Trạng thái đã xác minh                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Customer Web, Chủ salon, Nhân viên         | Source `89cee9a6b9febac888bd27f7511698969fb8f16e`, merge [PR #77](https://github.com/tantrong1706/haircut-mvp/pull/77)                |
| Customer Hosting                           | Site `haircut-c7d12`, version `71a00259847aef8f`, phát hành 27/10/2026                                                                |
| Admin riêng                                | Site `haircut-c7d12-admin`, version `27b031fa97bf982e`; không đổi trong đợt 27/10. Xem [bản phát hành Admin](ADMIN_RELEASE_STATUS.md) |
| Functions                                  | Đợt 27/10 không deploy Functions; đã so sánh và xác nhận metadata của cả 83 Functions không đổi trước/sau phát hành Hosting           |
| Rules, indexes, quyền và dữ liệu nghiệp vụ | Không thay đổi trong đợt 27/10                                                                                                        |

Đã đọc lại metadata Hosting vào ngày 27/10: Customer và Admin vẫn phục vụ đúng hai version ở trên.
Bản sao lưu và bằng chứng chi tiết được giữ ngoài Git; không commit credential, cấu hình riêng
hoặc bản sao source Functions có chứa thông tin riêng.

## Những thay đổi đã có trên website

- [PR #75](https://github.com/tantrong1706/haircut-mvp/pull/75): dọn tên/tài liệu Web; các thay đổi
  này đã nằm trong bản đang chạy, không còn ở trạng thái “chưa deploy”.
- [PR #76](https://github.com/tantrong1706/haircut-mvp/pull/76), source
  `6a167123bf196a61c29cecfb57cdb184cf31323c`: đã phát hành 26/10; Customer Hosting khi đó là
  `5a3de7074a1797a0`. Có đăng nhập quản lý chung theo vai trò, ảnh/ghi chú nội bộ và bổ sung
  thông tin cho lượt cắt vừa hoàn tất theo phân quyền, không cộng thêm điểm.
- Đợt 26/10 cũng phát hành đúng sáu API ảnh/lịch sử: `getWebCustomerHistory`,
  `getSalonCustomerDetails`, `beginHaircutPhotoUpload`, `finalizeHaircutPhotoUpload`,
  `getLatestHaircutDetails`, `updateLatestHaircutDetails`. Đây không phải tuyên bố toàn bộ 83
  Functions đều được deploy từ PR #76.
- PR #77: tách ba panel Owner, hook điều hướng và hàm định dạng dùng chung; giữ nguyên giao diện,
  nội dung, API và nghiệp vụ. Source trên được phát hành riêng Customer Hosting ngày 27/10.
  Phiên bản Hosting trước đợt này là `5a3de7074a1797a0`.

## Bằng chứng phát hành 27/10

- PR #77 đạt 9/9 kiểm tra trước merge. Mã nguồn sau merge trùng cây mã của PR đã kiểm thử.
- [Build Web trên main](https://github.com/tantrong1706/haircut-mvp/actions/runs/40447691074)
  và [CodeQL trên main](https://github.com/tantrong1706/haircut-mvp/actions/runs/40447691086): PASS,
  cùng source `89cee9a6b9febac888bd27f7511698969fb8f16e`.
- Chạy lại trên main: lint, định dạng, TypeScript, production build và 301/301 Web unit test PASS;
  35/35 ca trình duyệt Owner PASS trên năm cấu hình trình duyệt/kích thước màn hình.
- Đối chiếu SHA256 của 55 file đã phát hành với artifact đóng gói: PASS. Đã sao lưu và kiểm tra
  55 file của bản Hosting trước để có thể khôi phục.
- HTTPS, HTML đúng artifact và security headers: PASS trên 12 đường dẫn, gồm `/login`, `/owner`,
  `/staff`, `/history`, `/wheel`, `/rewards` và `/app-check`.
- Trình duyệt thật, ngữ cảnh chưa đăng nhập riêng: sáu trang trên điện thoại/máy tính, 12 lượt mở,
  giữ nguyên tiêu đề và chuyển hướng đăng nhập; lần kiểm tra cuối không ghi nhận lỗi JavaScript,
  console, HTTP, request thất bại hoặc tràn ngang.
- Không gửi OTP, email mời, tạo khách, sửa ảnh thật hoặc thực hiện giao dịch điểm/quà để kiểm tra
  đợt phát hành này. Không suy ra giao dịch thật đã PASS chỉ từ kiểm tra trang chưa đăng nhập.

Lần kiểm tra trình duyệt đầu ghi nhận một request Google Analytics thất bại; lần chẩn đoán tiếp
theo timeout khi đợi toàn bộ mạng rảnh. Cả hai được giữ trong bằng chứng ngoài Git, không ghi là
PASS. Lần cuối đợi giao diện/font sẵn sàng, vẫn kiểm tra lỗi ứng dụng và ghi riêng telemetry;
không ghi nhận lỗi ở lần đó. Không sửa ứng dụng hoặc cấu hình để ép kết quả đạt.

## App Check và API key — kiểm tra chỉ đọc ngày 27/10

| Hạng mục                                              | Kết quả quan sát                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Authentication (`identitytoolkit.googleapis.com`)     | `UNENFORCED`                                                                                         |
| Firestore (`firestore.googleapis.com`)                | `UNENFORCED`                                                                                         |
| Storage (`firebasestorage.googleapis.com`)            | `UNENFORCED`                                                                                         |
| Biến `ENFORCE_APP_CHECK` trên Functions đã triển khai | Cả 83 Functions có giá trị `false`; đây là kiểm tra biến cấu hình, không phải thử toàn bộ endpoint   |
| Cấu hình build Customer Web cục bộ                    | Đúng project; chưa có giá trị `VITE_FIREBASE_APP_CHECK_SITE_KEY`                                     |
| Đọc giới hạn API key                                  | Chưa xác minh: API quản lý khóa trả `403 SERVICE_DISABLED`; không lấy giá trị khóa, không tự bật API |

Không kết luận khóa đang không giới hạn từ lỗi đọc metadata. Khóa cấu hình Firebase Web là thông
tin nhận diện công khai, không thay cho đăng nhập/phân quyền. Khi rà soát cần xem đúng khóa đang
dùng, các API được phép và hạn mức; thử cấu hình hạn chế trên môi trường kiểm thử trước khi đổi
khóa production. Xem [hướng dẫn quản lý khóa của Firebase](https://firebase.google.com/docs/projects/api-keys).

Website hiện dùng `Referrer-Policy: no-referrer`. Cần kiểm tra tương thích trước khi thêm giới hạn
HTTP referrer, tránh tự chặn yêu cầu đăng nhập hợp lệ; chưa thay header hoặc giới hạn khóa.

## Kế hoạch App Check — chưa thực hiện thay đổi production

1. Kiểm kê đúng các ứng dụng/caller đang sử dụng: khách Web, chủ salon/nhân viên, Admin riêng và
   các caller tương thích còn hoạt động. Không mặc định mọi client đều đã sẵn sàng.
2. Xác minh khóa reCAPTCHA Enterprise, danh sách tên miền và cấu hình client cho từng Web app;
   kiểm tra lấy/refresh App Check token mà không ghi token ra log. Việc cấu hình/phát hành client
   phải được duyệt riêng; chưa bật chặn khi client còn thiếu khóa hoặc chưa có bằng chứng token.
3. Theo dõi request hợp lệ/thiếu/sai token trước khi chặn; kiểm tra đăng nhập, khôi phục phiên,
   điểm, ảnh và quà bằng dữ liệu thử được cho phép. Chưa đo tỷ lệ token hợp lệ trong lượt rà soát này.
4. Chỉ khi các client/caller liên quan đã đạt và được chủ dự án cho phép, bật lần lượt phạm vi đã
   kiểm chứng, có đường khôi phục; không bật đồng loạt 83 Functions hoặc mọi dịch vụ.
5. Rà soát Authentication/OTP riêng: cơ chế reCAPTCHA, chính sách vùng gửi SMS, hạn mức và cảnh báo
   chi phí. Cờ của callable Functions không tự bật enforcement cho Authentication.

[App Check cho callable Functions](https://firebase.google.com/docs/app-check/cloud-functions)
và [bật enforcement theo từng dịch vụ](https://firebase.google.com/docs/app-check/enable-enforcement)
là các phạm vi cấu hình riêng. App Check bổ sung chống lạm dụng, không thay kiểm tra vai trò,
salon/chi nhánh, chữ ký QR, rate limit hoặc quyền truy cập dữ liệu hiện có.

## Giới hạn và lịch sử

- Chưa kiểm tra camera/HEIC trực tiếp trên điện thoại vật lý trong đợt phát hành 27/10. Kết quả
  mô phỏng trình duyệt không thay thế bằng chứng đó; OTP thật cũng không được thử lại trong đợt này.
- Khách chỉ xem ngày cắt/điểm; ảnh và ghi chú là nội bộ salon, đọc/sửa theo phân quyền. Bổ sung
  cho lượt vừa hoàn tất không được đổi điểm, ngày lượt cắt hay thời gian chống cộng lặp.
- Không thu hồi hàng loạt link ảnh khách cũ; không thể thu hồi bản ảnh người dùng đã tải xuống.
- Không xóa dịch vụ, tunnel, API/secrets tương thích hoặc mã native trong đợt cập nhật tài liệu.
  Xem [ranh giới tương thích](LEGACY_COMPATIBILITY.md).
- [Bản ghi trạng thái 22/10 được giữ tại commit cố định](https://github.com/tantrong1706/haircut-mvp/blob/6a167123bf196a61c29cecfb57cdb184cf31323c/docs/RELEASE_STATUS.md).
  Các báo cáo có ngày/SHA trong `testing/` hoặc `archive/` là bằng chứng lịch sử, không phải danh
  sách lỗi hay số lượng kiểm thử hiện tại. Không xóa hoặc sửa lại lịch sử để làm đẹp trạng thái.
- Bằng chứng OTP cũ nằm trong [báo cáo Web customer](WEB_CUSTOMER_RELEASE_READINESS.md). Đây là
  bằng chứng theo từng thời điểm, không cam kết ứng dụng không còn lỗi hoặc bảo mật tuyệt đối.
