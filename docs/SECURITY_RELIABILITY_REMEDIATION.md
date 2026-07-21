# Khắc phục Security & Reliability Audit

## Trạng thái

- Nhánh: `fix/cross-tenant-data-leak`
- Base cục bộ: `534ab3ff004b26bb6b05d7b02ac103c22f827928`
  (`origin/codex/production-platform-upgrade`)
- Phát hiện xử lý: `SR-01`
- Trạng thái code: đã sửa, chưa deploy
- Trạng thái xác minh: chưa hoàn tất vì Firebase Emulator không thể khởi động
  trong sandbox hiện tại
- Commit SHA: chưa có; chưa commit do test Emulator bắt buộc chưa chạy đạt

## Audit finding

`searchSalonCustomers` và `lookupRewardCode` chỉ xác thực ở mức salon. Staff
được phân công chi nhánh A1 có thể gọi callable trực tiếp để đọc khách, ghi chú
cắt tóc và mã quà của chi nhánh A2 trong cùng salon.

Khi rà lại cùng mẫu lỗi, `redeemRewardCode` cũng có khoảng trống: endpoint xác
thực `branchId` được gửi lên nhưng chưa buộc reward trong transaction phải
thuộc đúng chi nhánh đó.

## Nguyên nhân gốc

- Query nhạy cảm chỉ lọc `salonId`, chưa có phạm vi `branchId` dành cho staff.
- `branchId` từ client chưa được đối chiếu thống nhất với hồ sơ user phía server.
- Cursor tìm khách chưa bị ràng buộc vào chi nhánh.
- Reward được tìm theo salon và code trước khi transaction, nhưng transaction
  chưa so sánh `reward.branchId` với chi nhánh đã cấp quyền.

## Thay đổi

- Thêm helper xác định phạm vi chi nhánh từ user profile phía server.
- Staff chỉ được dùng chi nhánh đã phân công; staff có nhiều chi nhánh phải chọn
  một chi nhánh cụ thể.
- Owner vẫn được xem toàn salon hoặc lọc một chi nhánh hợp lệ.
- Tìm khách của staff lọc theo `lastBranchId`; lịch sử và mã quà tiếp tục được
  lọc theo `branchId`.
- Staff không có `canRedeemRewards` không nhận reward code trong kết quả tìm
  khách.
- Cursor sai salon hoặc sai chi nhánh trả cùng lỗi trang không hợp lệ.
- Lookup mã quà sai salon/sai chi nhánh trả cùng trạng thái công khai với mã
  không tồn tại.
- Redeem giữ transaction/idempotency hiện có và kiểm tra lại salon, branch bên
  trong transaction.
- Frontend gửi `branchId` tới lookup; fallback query cũng áp dụng branch filter.
- Bổ sung composite indexes cho các query branch-scoped.

## Mô hình phân quyền sau sửa

1. Lấy `request.auth.uid`.
2. Tải `users/{uid}` phía server.
3. `assertSalonRole` kiểm tra user active, role và salon thật khớp `salonId`
   được gửi để tương thích client hiện tại.
4. `resolveAuthorizedBranchScope` kiểm tra branch assignment và trạng thái
   branch phía server.
5. Query chỉ chạy sau khi các bước trên thành công.
6. Mutation redeem kiểm tra lại reward, salon và branch trong transaction.

Frontend không phải nguồn sự thật về role, salon hay branch.

## Rà endpoint cùng mẫu lỗi

### Đã sửa

- `searchSalonCustomers`
- `lookupRewardCode`
- `redeemRewardCode`

### Đã có kiểm soát server phù hợp

- Nhóm owner-only: quản lý salon, chi nhánh, nhân viên, QR, cấu hình vòng quay,
  duyệt/từ chối điểm, xóa dữ liệu khách và hoàn tác mã quà.
- Nhóm owner/staff: `listBranches`, `submitPointRequest`,
  `claimServiceSession`, `cancelServiceSession`, đăng ký device token. Các
  endpoint nghiệp vụ lấy branch từ hồ sơ hoặc document server và gọi
  `assertBranchAccess`.
- Nhóm customer/Zalo: resolve QR, check-in, lịch sử, điểm, vòng quay và quà dùng
  xác minh QR/Zalo phía server.
- Nhóm system admin: dùng `assertSystemAdmin`.

### Chưa đủ bằng chứng production

- App Check effective configuration.
- Error/crash tracking và correlation log.
- Backup/restore drill.

Các mục này không cùng nguyên nhân với `SR-01` và không được sửa trong nhánh
này.

## Test đối kháng

File: `firebase/functions/test/adversarial.audit.test.ts`

17 trường hợp bao phủ:

- owner đúng/sai salon;
- staff đúng/sai chi nhánh;
- customer role và caller chưa đăng nhập;
- không trả khách, lịch sử hoặc reward code ngoài branch;
- không trả reward code cho staff thiếu quyền đổi quà;
- mã không tồn tại và mã ngoài salon có cùng trạng thái công khai;
- chặn redeem chéo branch;
- retry redeem cùng idempotency key không dùng quà hai lần.

## Kết quả kiểm tra cục bộ

| Kiểm tra               | Kết quả                                               |
| ---------------------- | ----------------------------------------------------- |
| Functions typecheck    | Đạt                                                   |
| Functions lint         | Đạt                                                   |
| Functions unit         | 63/63 đạt                                             |
| Functions build        | Đạt                                                   |
| Zalo TypeScript        | Đạt                                                   |
| Zalo lint              | Đạt                                                   |
| Zalo unit              | 67/67 đạt                                             |
| Zalo `build:zmp`       | Đạt                                                   |
| JSON indexes           | Hợp lệ                                                |
| Modified-file Prettier | Đạt                                                   |
| `git diff --check`     | Đạt trước khi tạo tài liệu này                        |
| Adversarial Emulator   | 17 test được nạp nhưng bị skip do Emulator không chạy |
| Rules Emulator         | Chưa chạy do cùng giới hạn môi trường                 |

Máy hiện dùng Node.js 24 trong khi repository yêu cầu Node.js 22. CI hoặc môi
trường Node.js 22 vẫn phải chạy lại toàn bộ kiểm tra trước review/merge.

Firebase Emulator thất bại trước khi test bắt đầu vì Java không được phép tạo
loopback selector trong sandbox. Yêu cầu chạy ngoài sandbox bị từ chối do giới
hạn sử dụng Codex, không phải do assertion của test.

## Rủi ro còn lại

- Chưa có bằng chứng 17 test adversarial và Rules test đạt trên Emulator.
- Chưa xác minh composite indexes trên Firebase test project.
- Chưa xác minh hành vi production; không được coi nhánh này là sẵn sàng merge
  cho đến khi test bắt buộc đạt trên Node.js 22.
- Hai High khác của audit là production observability và restore drill vẫn còn,
  phải xử lý ở branch riêng.

## Production

- Deploy: không
- Migration: không
- Restore: không
- Merge: không
- Dữ liệu thật: không truy cập
