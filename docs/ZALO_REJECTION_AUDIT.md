# Kiểm toán Zalo Mini App Version 7 bị từ chối

> **HISTORICAL:** tài liệu này giữ nguyên tên Mini App tại thời điểm Version 7 để bảo toàn bằng
> chứng. Tên chính thức hiện hành là **CH Haircut Salon**.

## 1. Phạm vi và kết luận

- Repository: `tantrong1706/haircut-mvp`
- Nhánh: `codex/production-platform-upgrade`
- Mini App: HAIRCUT
- Mini App ID: `2038116772828167300`
- Version 7 tải lên lúc 13:21:46 ngày 16/07/2026 (+07)
- Ghi chú phiên bản: `HAIRCUT luồng khách nhanh và vòng quay - QR test`

**Không thể xác nhận nguyên nhân chính thức từ phía Zalo.** Không có email, ticket, nội dung chi
tiết của dòng Version 7 hoặc artifact deploy gắn với Version 7 để chứng minh một nguyên nhân duy
nhất.

Nguyên nhân kỹ thuật có độ tin cậy cao nhất là reviewer không có ngữ cảnh QR hợp lệ để hoàn tất
luồng khách: khi mở link chung, source ứng viên chỉ hiện màn yêu cầu QR và còn đưa reviewer tới
trang owner/staff. Ghi chú gửi xét duyệt không cung cấp đủ hướng dẫn tái hiện luồng.

## 2. Truy nguyên source Version 7

### Bằng chứng thời gian

| Mốc                                               | Thời gian               | Kết luận                                                            |
| ------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| Commit `15f75e4a57a6323da0a10c0581f758621dff8eb4` | 15/07/2026 16:57:28 +07 | Commit mới nhất trên mọi ref trước lúc upload Version 7             |
| Upload Version 7                                  | 16/07/2026 13:21:46 +07 | Mốc do hồ sơ nhiệm vụ cung cấp                                      |
| Commit `fa9edb019bdf73086593792b1ae82c00f58adc17` | 16/07/2026 13:43:52 +07 | Sau upload 22 phút 06 giây; không được mặc định là source Version 7 |

`15f75e4...` là **HIGH CONFIDENCE source candidate**, không phải artifact được xác nhận. Một số
file của commit sau có thời gian sửa local trước lúc upload, nên vẫn có khả năng Version 7 được build
từ working tree chưa commit.

### Dấu vết local

- PowerShell history có nhiều lệnh `zmp deploy`, nhưng history không có timestamp hoặc Version ID.
- Không tìm thấy ZMP deploy log/cache, zip hoặc artifact còn nguyên có thể gắn trực tiếp với Version 7.
- Thư mục `www` hiện tại đã bị các build mới ghi đè.
- Git reflog xác nhận `fa9edb...` được commit sau upload; không có stash liên quan.
- Không đọc hoặc in nội dung token, secret, file môi trường cá nhân hay credential.

Kết luận: **không tìm thấy artifact hoặc log deploy thật của Version 7**.

## 3. Build tái dựng

Worktree tạm được tạo tại commit `15f75e4...` và chạy:

```text
npm ci
npm run lint
npm run format:check
npm run test:run
npm run build:zmp
```

Kết quả:

- Lint: pass.
- Format check: fail trên 75 file theo cấu hình Prettier hiện tại.
- Unit test: 48/48 pass, 17/17 test file pass.
- `build:zmp`: pass; `app-config.json` và asset ZMP hợp lệ.
- Artifact tái dựng: 33 file văn bản/build, tổng 1.328.064 byte.
- Asset lớn nhất: `firebase-firestore...module.js`, 262.639 byte.
- Không có asset đơn vượt 500 KB.

Format fail không chứng minh nguyên nhân Zalo từ chối; đây chỉ là trạng thái source tái dựng.

## 4. So sánh candidate với source hiện tại

| Khu vực                | Candidate `15f75e4...`                                        | Trạng thái sau khắc phục                                      |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Link chung không QR    | Hiện yêu cầu QR và nút owner/staff                            | Chỉ hiện hướng dẫn khách, Privacy và Terms trong runtime Zalo |
| Route quản lý          | Có thể mở `/owner`, `/staff`, `/admin`, `/delete-account`     | Runtime Zalo chuyển các route này về luồng khách              |
| Hồ sơ Zalo             | `getUserInfo({ autoRequestPermission: true })` ngay khi có QR | Đọc không bật popup trước; chỉ bật popup sau nút cho phép     |
| Số điện thoại Zalo     | Helper tồn tại nhưng không được gọi trong candidate           | API và lời gọi đã bị loại khỏi frontend                       |
| Terms                  | Không có route/trang Terms trong source candidate             | Có `/terms`, liên kết hai chiều với Privacy                   |
| Privacy                | Có `/privacy`, nhưng chưa mô tả ảnh Zalo tạm thời             | Mô tả đúng dữ liệu và quyền thực tế                           |
| Webhook xóa dữ liệu    | Không có trong candidate commit                               | Có source và test ở HEAD trước nhiệm vụ này                   |
| Backend authentication | Xác minh access token với `appsecret_proof`                   | Tiếp tục giữ xác minh server-side                             |

Tham chiếu trạng thái đã sửa:

- `zalo-mini-app/src/App.tsx:51,87`
- `zalo-mini-app/src/pages/ScanEntryPage.tsx:245-277`
- `zalo-mini-app/src/services/zalo.ts:52-64`
- `zalo-mini-app/src/pages/PrivacyPage.tsx:21-31,71`
- `zalo-mini-app/src/pages/TermsPage.tsx:20-31,101`
- `firebase/functions/src/index.ts:852-904,2361-2375`

## 5. Đối chiếu tài liệu Zalo chính thức

Tài liệu chính thức được kiểm tra ngày 18/07/2026:

- [Phát hành Zalo Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program):
  ứng dụng phải hoạt động bình thường, có hiệu năng/UI/UX tốt, bảo vệ quyền riêng tư và dùng
  Authentication Zalo.
- [Hướng dẫn xin cấp quyền](https://docs.zaloplatforms.com/docs/MA/intro/request-permission):
  chỉ xin quyền cần thiết và xin đúng ngữ cảnh.
- [`getPhoneNumber`](https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getPhoneNumber):
  phải giải thích rõ mục đích trước khi xin; Zalo nêu rõ luồng xin quyền không rõ có thể bị từ chối.
- [`getUserInfo`](https://docs.zaloplatforms.com/docs/MA/api/user/user-information/getUserInfo):
  tên và ảnh cần người dùng cho phép; `autoRequestPermission` điều khiển popup.
- [Đăng nhập và định danh Zalo](https://docs.zaloplatforms.com/docs/MA/intro/best-practices/authen-user):
  access token phải được gửi về server và profile server-side cần `appsecret_proof`.
- [Các điểm truy cập Mini App](https://docs.zaloplatforms.com/docs/MA/intro/intro/entry-point-access):
  ngoài QR, Mini App còn có thể được mở từ Store, tìm kiếm, shortcut hoặc chia sẻ.

## 6. Bảng giả thuyết

| ID  | Phân loại                                        | Phát hiện                                                                                                                                   | Độ tin cậy liên quan tới rejection |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| H1  | HIGH CONFIDENCE                                  | Link chung candidate không crash nhưng không thể tạo lượt; chỉ yêu cầu QR.                                                                  | 90%                                |
| H2  | POSSIBLE                                         | Không có bằng chứng Portal đã nhận QR/deeplink demo còn hiệu lực. Checklist cũ vẫn để bước đính kèm QR chưa hoàn tất.                       | 70%                                |
| H3  | HIGH CONFIDENCE                                  | Candidate tái dựng chứa nút owner/staff ngay trên màn khách không QR.                                                                       | 85%                                |
| H4  | RULED OUT cho runtime candidate                  | `getPhoneNumber` có trong SDK/helper nhưng không được luồng check-in candidate gọi. Trạng thái quyền trên Portal chưa xác minh.             | 20%                                |
| H5  | HIGH CONFIDENCE                                  | Candidate gọi quyền profile tự động khi mở QR, trước một thao tác giải thích riêng.                                                         | 85%                                |
| H6  | CONFIRMED về source, POSSIBLE về nguyên nhân     | Candidate không có trang/route Terms; Privacy có tồn tại. Terms có thể đã được nhập riêng trên Portal nhưng không có bằng chứng.            | 65%                                |
| H7  | CONFIRMED về metadata, HIGH CONFIDENCE về rủi ro | Ghi chú `... QR test` không mô tả precondition, QR/deeplink và kết quả reviewer cần thấy.                                                   | 85%                                |
| H8  | POSSIBLE                                         | Candidate frontend/backend trong Git tương thích, nhưng không có log Firebase/Zalo deploy để chứng minh hai phía lúc review cùng phiên bản. | 45%                                |
| H9  | POSSIBLE                                         | Tài khoản Admin/Developer có thể dùng API chưa duyệt; chưa có bằng chứng test bằng Zalo thường ngoài nhóm phát triển.                       | 65%                                |
| H10 | RULED OUT trong build tái dựng                   | Build và ZMP asset validation pass; mọi asset được `app-config.json` tham chiếu đều tồn tại.                                                | 15%                                |
| H11 | RULED OUT theo source/test                       | Runtime nhận Zalo bridge, Zalo user-agent/host và preview; browser thường không bị nhận nhầm trong unit test.                               | 15%                                |
| H12 | POSSIBLE cho Version 7; CONFIRMED ở audited HEAD | Candidate thiếu Terms. Audited HEAD trước sửa tự xin số Zalo trong khi hồ sơ ghi số chỉ tự nhập; sai lệch này đã được sửa.                  | 55%                                |

Các tỷ lệ trên là đánh giá kỹ thuật, không phải kết luận của Zalo.

## 7. Lỗi đã sửa

1. Link chung không QR trong Zalo không còn hiển thị owner/staff.
2. Route quản lý bị chặn trong customer Zalo runtime nhưng giữ nguyên trên browser.
3. Không còn gọi `getPhoneNumber`; số điện thoại là tùy chọn do khách tự nhập.
4. Profile permission chỉ bật popup sau khi khách bấm nút có giải thích.
5. Privacy mô tả đúng ID/tên/avatar Zalo, số điện thoại và dữ liệu ảnh.
6. Terms không còn đưa khách sang màn xóa tài khoản quản lý.
7. Có test cho no-QR, permission denied/retry và route isolation.
8. Có readiness script kiểm tra source, config, artifact, secret pattern và giới hạn 500 KB.

## 8. Điều chưa thể xác nhận

- Lý do chính thức Zalo từ chối Version 7.
- Artifact chính xác đã upload.
- QR/deeplink nào đã đính kèm vào hồ sơ Version 7.
- Quyền nào được yêu cầu hoặc được duyệt trên Portal tại thời điểm review.
- Firebase backend nào đang chạy lúc Version 7 được reviewer mở.
- Hành vi trên Android/iPhone thật và Zalo thường ngoài nhóm Developer/Admin.

## 9. Việc phải kiểm tra thủ công trên Portal

1. Mở chi tiết Version 7 và lưu lại nguyên văn lý do/ticket nếu Zalo hiển thị.
2. Không yêu cầu quyền **Mở tính năng quét QR Code**: khách quét QR trước khi vào app, frontend
   không gọi `scanQRCode`.
3. Không yêu cầu quyền số điện thoại cho Version 8.
4. Chỉ mô tả quyền hồ sơ Zalo cơ bản và đúng màn hình xin quyền.
5. Tạo QR/deeplink testing mới, kiểm tra còn hiệu lực bằng tài khoản Zalo thường.
6. Điền QR/deeplink thật vào `docs/ZALO_VERSION_8_SUBMISSION.md`; không commit token QR.
7. Chụp Android và iPhone thật cho link chung, QR salon, QR chi nhánh, từ chối/cấp quyền và check-in.
