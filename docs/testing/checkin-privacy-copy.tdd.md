# Gọn quyền ảnh và cài đặt quyền riêng tư

Ngày kiểm tra: 05/11/2026 (Asia/Saigon). Baseline: main
`12132a056491adfd72613dbe97a87c71a7f03060`.

## Phạm vi và yêu cầu

Yêu cầu được chốt trực tiếp trong trao đổi, không có file plan riêng:

- Nhãn đồng ý ảnh chỉ còn **Cho phép salon chụp và lưu ảnh**.
- Bỏ số lượng ảnh và câu chữ không bắt buộc khỏi màn check-in; giữ nguyên checkbox tự chọn,
  giới hạn upload phía server, đường dẫn giải thích và khả năng tích điểm khi chưa đồng ý ảnh.
- Không tự hiện bảng quyền riêng tư khi vào trang hoặc khi dữ liệu lựa chọn bị xóa.
- Người dùng mở bảng bằng Cài đặt quyền riêng tư hoặc nút mở cài đặt trên trang cookie.
- Cài đặt quyền riêng tư và Quyền dữ liệu nằm dưới nội dung chính; không bị thanh điều hướng
  khách che trên điện thoại. Giữ thống kê tắt khi chưa đồng ý và không xóa phiên đăng nhập.
- Sửa riêng độ tương phản hai nút trong bảng quyền riêng tư, sau khi kiểm thử phát hiện lỗi.

Không sửa backend, Auth, API/data contracts, Rules, IAM, App Check, điểm/quà hoặc dependency.

## TDD và checkpoint

| Hành vi                 | RED đã chạy                                                           | GREEN đã chạy                                         | Checkpoint            |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- |
| Câu đồng ý ảnh ngắn     | Vitest WebCustomerEntryPage: 1 lỗi đúng nhãn chưa có, 15 test cũ PASS | Cùng file: 16/16 PASS                                 | `098b137` → `c63393e` |
| Bảng chỉ mở khi yêu cầu | 2 test lọc trạng thái đầu và storage event đều FAIL do bảng tự mở     | 35 test component/consent/monitoring/check-in PASS    | `5360d36` → `794fa34` |
| Liên kết ở chân trang   | Chromium: vị trí liên kết y=12, trước đáy main y=891.984375           | 23 unit và 6 browser case PASS, gồm tránh che bởi nav | `3438a79` → `ebc75ed` |
| Nút đọc rõ trên nền tối | Axe: cả hai nút có contrast 1.09:1, dưới 4.5:1                        | 3 Chromium/WebKit browser case và Axe PASS            | `2099f81` → `f60629d` |

Lượt `npm run check` đầu tiên chạy unit PASS nhưng build/typecheck FAIL vì test RTL dùng
thuộc tính `exact` không được API đó hỗ trợ. Đã bỏ thuộc tính này; tên chuỗi vẫn khớp chính xác.
Build test và toàn bộ kiểm tra cuối được chạy lại, không hạ kiểm tra TypeScript hoặc bỏ test.

## Kiểm chứng cuối

| Lệnh thực thi                                   | Kết quả                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run check` trong customer-web              | PASS: ESLint, Prettier, 374 unit test, TypeScript và production build                                  |
| `npm run test:privacy:coverage`                 | PASS: 39 test; nhóm privacy 100% lines/statements/functions, 96.77% branches; threshold 80% giữ nguyên |
| `npm run build:test` rồi `npm run test:e2e:run` | PASS: 78 test trên desktop Chromium, mobile Chromium và mobile WebKit                                  |
| `node --test test/*.test.mjs` tại root          | PASS: 154 test                                                                                         |
| `node scripts/check-secrets.mjs`                | PASS, không in nội dung credential                                                                     |
| `node scripts/sync-csp.mjs --check`             | PASS                                                                                                   |
| `git diff --check`                              | PASS                                                                                                   |

Kiểm thử trình duyệt chứng minh vị trí chân trang, mở/đóng bằng thao tác người dùng,
lựa chọn thiết yếu, rút đồng ý thống kê không mất login, quyền ảnh và khôi phục phiên khách.
Không có test mới dùng `skip`, không giảm threshold hoặc thay kết quả để đạt PASS.
Ảnh kiểm tra đóng/mở bảng được ghi trong thư mục output của Playwright theo từng project.

## Giới hạn và trạng thái phát hành

- Đây là kiểm thử local/fixture, không phải gửi SMS thật hoặc kiểm tra điện thoại vật lý.
- Không dùng dữ liệu khách thật hoặc thay đổi điểm/quà để thử.
- Bản giao diện này chưa push GitHub, chưa chạy CI trên GitHub, chưa merge main và chưa deploy.
- Không dùng kết quả local để khẳng định website thật đã nhận các chỉnh sửa này.
- Phiên Auth được giữ theo cơ chế hiện có; không hứa OTP một lần vĩnh viễn qua việc xóa dữ liệu,
  đổi trình duyệt/thiết bị hoặc thu hồi phiên.

Log local chi tiết nằm trong `.tmp/`, không đưa artifact build hay credentials vào Git.
