# Khắc phục Security & Reliability Audit

## Trạng thái

- Nhánh: `fix/cross-tenant-data-leak`
- Base mới: `378fcf6084a75de1f752c201e82afa1671f5a20a`
  (`origin/codex/production-platform-upgrade`)
- Head trước rebase: `9a9c0131d5f63f959a005b4a6840e27c04243eeb`
- Commit code đã xác minh:
  `62f1c0f52ae0f15981b8becd6284224df52d5dd6`
- Phát hiện xử lý: `SR-01`
- Trạng thái code: đã sửa và kiểm tra cục bộ; chưa deploy
- Pull request `#19`: đã được merge trước khi thực hiện lượt khắc phục này

## Kết quả rebase

Nhánh `fix/cross-tenant-data-leak` được cập nhật lên
`origin/codex/production-platform-upgrade` bằng fast-forward. Head cũ của PR là
tổ tiên trực tiếp của base mới nên không có conflict, không cần force-push và
không có commit chức năng nào từ base bị loại bỏ.

Các chức năng mới của `searchSalonCustomers` vẫn được giữ nguyên:

- lịch sử và tên chi nhánh;
- `branchId`, `branchName` và `branchVisits`;
- ảnh kiểu tóc chỉ dành cho owner;
- lịch sử quà đầy đủ dành cho owner;
- giới hạn dữ liệu khác nhau giữa owner và staff.

## Audit finding

`searchSalonCustomers` áp dụng phạm vi chi nhánh lên document khách bằng
`lastBranchId`. Trường này chỉ mô tả lần ghé gần nhất, không chứng minh khách
thuộc một chi nhánh.

Khách từng ghé A1 nhưng vừa ghé A2 vì vậy biến mất khỏi kết quả của staff A1.
Khách cũ không có `lastBranchId` cũng không thể được tìm thấy, dù hồ sơ khách và
điểm phải dùng chung trong toàn salon.

## Nguyên nhân gốc

- Phạm vi tenant của hồ sơ khách và phạm vi nghiệp vụ theo chi nhánh bị đồng
  nhất sai.
- Query và cursor khách cùng tin `lastBranchId` như quan hệ sở hữu chi nhánh.
- `lastBranchId` là dữ liệu gần nhất, không phải danh sách chi nhánh khách từng
  sử dụng.

## Thay đổi

- Query document khách chỉ lọc theo `salonId` và tiêu chí tìm tên hoặc bốn số
  cuối điện thoại.
- Cursor chỉ hợp lệ khi document tồn tại và thuộc đúng salon đã xác thực.
- Staff vẫn phải chọn chi nhánh được phân công từ hồ sơ user phía server.
- `haircut_records` và `reward_history` tiếp tục được query theo `salonId`,
  `customerId` và chi nhánh đã cấp quyền trước khi giới hạn kết quả.
- Staff không nhận số điện thoại đầy đủ, ảnh kiểu tóc, `branchVisits` hoặc lịch
  sử quà đầy đủ.
- Staff không có `canRedeemRewards` luôn nhận danh sách quà rỗng.
- Owner vẫn xem được toàn salon hoặc giới hạn dữ liệu nghiệp vụ theo chi nhánh
  được chọn.
- Giữ nguyên kiểm tra salon/branch trong `lookupRewardCode` và transaction của
  `redeemRewardCode`, bao gồm idempotency.
- Xóa hai composite index chỉ phục vụ tìm khách bằng `lastBranchId` kết hợp với
  `namePrefixes` hoặc `phoneLast4`.
- Giữ index `salonId + lastBranchId + lastVisitAt` vì dashboard vẫn dùng để lọc
  khách lâu chưa quay lại theo chi nhánh.

## Mô hình phân quyền sau sửa

1. Lấy `request.auth.uid`.
2. Tải `users/{uid}` phía server.
3. Xác minh user active, role và salon.
4. Xác minh chi nhánh yêu cầu nằm trong `branchId` hoặc `branchIds` được phân
   công và chi nhánh đang hoạt động.
5. Tìm hồ sơ khách trong toàn salon.
6. Chỉ tải records, ghi chú và rewards trong phạm vi chi nhánh đã xác minh cho
   staff.
7. Owner có thể xem dữ liệu toàn salon hoặc lọc dữ liệu nghiệp vụ theo chi
   nhánh.

Frontend không phải nguồn sự thật về role, salon hoặc branch.

## Test regression

File: `firebase/functions/test/adversarial.audit.test.ts`

Các tình huống mới hoặc được cập nhật:

- khách có lịch sử A1 và A2, `lastBranchId` là A2, staff A1 vẫn tìm thấy bằng
  tên và bốn số cuối điện thoại;
- staff A1 chỉ thấy record, ghi chú và quà của A1;
- staff không thấy số điện thoại đầy đủ, ảnh owner, `branchVisits` hoặc lịch sử
  quà đầy đủ;
- staff thiếu quyền đổi quà nhận danh sách quà rỗng;
- khách cũ không có `lastBranchId` vẫn được tìm thấy;
- owner xem được lịch sử toàn salon và lọc theo chi nhánh;
- khách của salon khác không xuất hiện với owner hoặc staff salon A;
- lookup và redeem quà tiếp tục chặn chéo salon/chi nhánh;
- redeem lặp lại cùng idempotency key không dùng quà hai lần.

## Kết quả kiểm tra cục bộ

Môi trường Functions: Node.js `22.23.1`, Java `21.0.11`, Firebase CLI
`15.22.3`.

| Kiểm tra                                     | Passed | Failed | Skipped | Kết quả |
| -------------------------------------------- | -----: | -----: | ------: | ------- |
| Functions `npm ci`                           |      - |      0 |       0 | Đạt     |
| Functions typecheck                          |      - |      0 |       0 | Đạt     |
| Functions lint                               |      - |      0 |       0 | Đạt     |
| Functions build                              |      - |      0 |       0 | Đạt     |
| Functions unit                               |     63 |      0 |       0 | Đạt     |
| Firestore và Storage Rules Emulator          |     18 |      0 |       0 | Đạt     |
| Callable integration và adversarial Emulator |     39 |      0 |       0 | Đạt     |
| Zalo `npm ci`                                |      - |      0 |       0 | Đạt     |
| Zalo TypeScript (`npx tsc --noEmit`)         |      - |      0 |       0 | Đạt     |
| Zalo lint                                    |      - |      0 |       0 | Đạt     |
| Zalo unit                                    |     70 |      0 |       0 | Đạt     |
| Zalo `build:zmp`                             |      - |      0 |       0 | Đạt     |
| Prettier trên file thay đổi                  |      4 |      0 |       0 | Đạt     |
| `git diff --check`                           |      - |      0 |       0 | Đạt     |

Tổng các bộ test có số lượng: `190 passed`, `0 failed`, `0 skipped`.

Package Zalo không khai báo script `typecheck`; lệnh tương đương
`npx tsc --noEmit` đã được dùng. Không chạy Prettier toàn repository và không
thay đổi dependency.

## Rủi ro còn lại

- Chưa truy cập hoặc xác minh trên dữ liệu production.
- Hai index tìm khách không còn dùng đã được xóa khỏi cấu hình nhưng chưa
  deploy; index hiện có trên Firebase chỉ nên xóa trong một đợt vận hành riêng
  sau khi bản Functions mới được phát hành và theo dõi ổn định.
- App Check effective configuration, error/crash tracking và backup/restore
  drill vẫn chưa có đủ bằng chứng production.
- `npm ci` ghi nhận 13 lỗ hổng dependency hiện có trong Functions và 24 trong
  Zalo Mini App. Không chạy `npm audit fix` để tránh thay đổi dependency ngoài
  phạm vi.
- GitHub CI cho head mới cần được quan sát sau khi push.

## Production

- Deploy: không
- Migration: không
- Restore: không
- Merge: không thực hiện trong lượt này
- Dữ liệu thật: không truy cập
