# Khắc phục Security & Reliability Audit

## Trạng thái

- Nhánh: `fix/cross-tenant-data-leak`
- Base: `6ecce4fb88d68f2cddf2f056a751ba6e3cf6834c`
  (`origin/codex/production-platform-upgrade`)
- Phát hiện xử lý: `SR-01`
- Trạng thái code: đã sửa và hòa giải với integration mới nhất; chưa deploy
- Trạng thái xác minh: đã hoàn tất kiểm tra cục bộ trên Node.js 22.23.1
- Commit bản vá: `586501905d9f6c45d42ecde1d0796a9a8fc11fcf`
- Commit hòa giải integration:
  `f61ca9756d6b44bb2d17eddf8019241e88c1c1c1`
- Pull request: Draft PR `#19`

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

Môi trường xác minh: Node.js `22.23.1`, Java `21.0.11`, Firebase CLI
`15.22.3`.

| Kiểm tra                            | Kết quả              |
| ----------------------------------- | -------------------- |
| Functions typecheck                 | Đạt                  |
| Functions lint                      | Đạt                  |
| Functions build                     | Đạt                  |
| Functions unit                      | 63/63 đạt            |
| Firestore và Storage Rules Emulator | 18/18 đạt, 0 skipped |
| Callable integration                | Đạt                  |
| Adversarial Emulator                | 17/17 đạt, 0 skipped |
| Tổng integration và adversarial     | 36/36 đạt            |
| Zalo TypeScript                     | Đạt                  |
| Zalo lint                           | Đạt                  |
| Zalo unit                           | 67/67 đạt            |
| Zalo `build:zmp`                    | Đạt                  |
| Conflict-file Prettier              | 2/2 file đạt         |
| `git diff --check`                  | Đạt                  |
| `git diff --cached --check`         | Đạt                  |

Lệnh `format:check` toàn bộ Zalo Mini App phát hiện 86 file có định dạng cũ từ
nhánh nền. Không chạy Prettier tự động trên toàn dự án để tránh thay đổi các file
không thuộc phạm vi bản vá. Ba file Zalo được sửa trong PR đều đạt Prettier.

Các test Emulator đã được chạy lại sau khi hòa giải conflict bằng Node.js
`22.23.1` và kết thúc thành công với mã thoát `0`.

## Rủi ro còn lại

- Composite indexes đã được thêm vào repository nhưng chưa triển khai và xác minh
  trên Firebase test project hoặc production.
- Chưa xác minh hành vi trên dữ liệu production; không deploy hoặc merge trước
  khi CI và quá trình review độc lập hoàn tất.
- App Check effective configuration, error/crash tracking, correlation log và
  backup/restore drill vẫn chưa có đủ bằng chứng production.
- Hai phát hiện High còn lại của audit về observability và restore drill phải
  được xử lý trong các nhánh riêng.
- `npm ci` ghi nhận các lỗ hổng dependency hiện có, nhưng không tự động chạy
  `npm audit fix` hoặc thay đổi dependency trong PR bảo mật này để tránh mở rộng
  phạm vi và gây breaking change.
- Kiểm tra Prettier toàn bộ Zalo Mini App vẫn phát hiện 86 file định dạng cũ từ
  nhánh nền; ba file Zalo thuộc bản vá này đều đạt kiểm tra định dạng.

## Production

- Deploy: không
- Migration: không
- Restore: không
- Merge: không
- Dữ liệu thật: không truy cập
