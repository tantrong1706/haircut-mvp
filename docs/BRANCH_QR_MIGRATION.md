# Migration QR salon và chi nhánh

## Mục tiêu

- Mỗi salon có một QR chung; mỗi chi nhánh có một QR riêng.
- Khách và điểm vẫn dùng chung toàn salon.
- Hàng chờ, yêu cầu điểm, lịch sử cắt, nhân viên và dữ liệu báo cáo có `branchId`.
- QR Gương 1 cũ tiếp tục hoạt động; không xóa collection `mirrors`.

## Cơ chế an toàn

- Chi nhánh mặc định dùng ID xác định từ `salonId`, nên chạy migration nhiều lần không tạo trùng.
- Firestore chỉ lưu `salonQrVersion` hoặc `branches.qrVersion`, không lưu token QR mới.
- Token là chữ ký HMAC 256 bit và thay đổi khi owner tạo lại QR.
- Migration chỉ bổ sung trường còn thiếu, không xóa hoặc đổi `customerId`, điểm và lịch sử.

## Thứ tự phát hành

1. Sao lưu Firestore hoặc tạo export trước khi chuyển đổi.
2. Tạo Firebase secret `QR_SIGNING_SECRET` dài tối thiểu 32 ký tự.
3. Deploy riêng các Function quản lý chi nhánh và `migrateSalonBranches`.
4. Mở mục **Chi nhánh** bằng tài khoản owner và bấm **Chuyển dữ liệu Gương 1 cũ** cho từng salon.
5. Chạy lại nút migration một lần; kết quả không được tạo thêm chi nhánh mặc định.
6. Kiểm tra staff đã có `branchIds`, các collection nghiệp vụ đã có `branchId` và mirror cũ có `branchId`.
7. Deploy index mới và chờ trạng thái index hoàn tất.
8. Deploy toàn bộ Functions, frontend, Firestore Rules và Storage Rules.
9. Chỉ in/phát QR salon và QR chi nhánh mới sau khi test đủ ba vai trò.

## Dữ liệu được backfill

- `users` vai trò staff: `branchId`, `branchIds`.
- `mirrors`: `branchId` để giữ QR cũ.
- `chair_sessions`, `active_service_sessions`, `point_requests`, `haircut_records`, `reward_history`:
  `branchId`, `branchName`.
- `customers`: `lastBranchId`, `lastBranchName` để gắn lượt quay và báo cáo gần nhất.

## Kiểm tra sau migration

- QR salon có 0, 1 và nhiều chi nhánh cho đúng trạng thái.
- QR chi nhánh bị khóa hoặc QR đã xoay không tạo được lượt.
- Staff không đọc hoặc nhận khách ở chi nhánh ngoài `branchIds`.
- QR Gương 1 cũ vẫn mở đúng Chi nhánh chính.
- Chạy migration lần hai không tăng số document `branches`.

## Rollback

- Không xóa `mirrors` hoặc trường cũ trong đợt migration này.
- Có thể rollback frontend/Functions về commit trước; dữ liệu mới chỉ là trường bổ sung.
- Nếu rollback Rules, dùng phiên bản Rules cùng commit ứng dụng cũ rồi kiểm tra lại quyền trước khi mở salon.
