# Vá dependency Web — hoàn tất kiểm tra ngày 09/10/2026

Phạm vi: bản vá tương thích của Customer Web; rà lại các cảnh báo Manager/Admin ngày 08/10.
Không deploy production, không thay SDK Firebase/Zalo, OTP, dữ liệu, Rules hoặc App Check.

## Thay đổi

| Gói mục tiêu                 | Trước   | Sau     |
| ---------------------------- | ------- | ------- |
| brace-expansion (production) | 1.1.16  | 1.1.21  |
| browserslist                 | 4.28.4  | 4.29.3  |
| baseline-browser-mapping     | 2.10.40 | 2.11.27 |

Npm cũng cập nhật các bản brace-expansion dev trong range và dữ liệu đi kèm browserslist
(`caniuse-lite`, `electron-to-chromium`, `node-releases`, `update-browserslist-db`).
Manifest dependency trực tiếp không đổi. Không dùng override vượt range hoặc `audit fix --force`.

## Bằng chứng TDD

- RED `d73bdc6`: 3/5 test fail do phiên bản thấp hơn mốc đã vá; 2 hành vi hợp lệ vẫn PASS.
- GREEN `2ad6109`: 5/5 PASS trên bản cài sau cập nhật; test đưa vào job Customer Web của CI.
- Command: `node --test test/web-dependency-security.test.mjs`.
- Kiểm tra các bản production của ba gói mục tiêu và hành vi brace/browser query bình thường;
  không chạy payload gây cạn bộ nhớ, không thử khai thác trên production.
- Tiến trình cài/test local trước bị mất đầu ra khi phiên công cụ gián đoạn: không suy diễn rằng
  toàn bộ test local đã PASS. CI của đúng source commit là bằng chứng hồi quy cuối cùng.

## Audit và ranh giới chưa xử lý

[CI 37891300365](https://github.com/tantrong1706/haircut-mvp/actions/runs/37891300365) của commit
`2ad6109ed2ecc7d92edee97cd96bea17a2ee3b42`: **6/6 jobs PASS**, gồm Customer Web, Manager,
Admin, Firebase Functions/Rules/integration, Browser flows và Repository Checks.
Audit lockfile được đọc lại ngày 09/10 vẫn là 0 Critical / 8 High / 1 Moderate cho Customer Web.

Snapshot ngày 08/10 với `npm audit --omit=dev`: Customer Web từ **0 Critical / 10 High / 2 Moderate**
xuống **0 Critical / 8 High / 1 Moderate** theo lockfile sau thay đổi.
Package alerts có thể kế thừa qua nhiều gói cha, không tương đương số đường khai thác độc lập.

- ZMP còn kéo Sentry cũ và Babel/chokidar/braces. Registry chưa có braces 3 mới hơn 3.0.3 khi kiểm tra.
  Cần tách/gỡ tương thích Zalo khỏi frontend Web bằng một thay đổi riêng có test; không xóa backend
  hoặc secret theo tên, không sửa nhánh archive.
- Firebase của ba app còn gRPC cũ. Metadata Firebase 12.19.0 dùng Firestore 4.17.2 và gRPC `~1.9.0`;
  nâng minor đơn thuần chưa xử lý cảnh báo này. Không hạ Firebase về 9.14.0 hoặc ép override ngoài range.
- Admin: **0 Critical / 4 High / 0 Moderate** (snapshot 08/10), chưa đổi lockfile.
- Manager: **2 Critical / 6 High / 0 Moderate** (snapshot 08/10). Hai Critical thuộc Capacitor Android/iOS
  8.4.2. Đây là nền tảng native, cần đợt vá và kiểm thử Android/iOS riêng; không thể công bố đã vá native
  chỉ nhờ CI Web. Không phát hành native từ phiên bản này khi chưa xử lý.
- Không dùng kết quả backend 0 Critical/0 High của lượt trước để đại diện cho toàn repo.

## Nguồn và bước tiếp theo

- [Browserslist](https://github.com/browserslist/browserslist/security/advisories/GHSA-c83g-rgw3-j3cx).
- [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr).
- [Capacitor native](https://github.com/advisories/GHSA-rvm3-566m-v7fv): cần build và phân phối lại
  native app sau khi cập nhật; chỉ tắt CapacitorHttp không đủ.

Các bản vá source chưa có hiệu lực trên production cho tới khi phát hành đúng phạm vi. Bản vá dependency
backend cần Functions, bản vá Rules cần Rules, bản vá Web cần Hosting; chưa triển khai phần nào trong lượt này.
