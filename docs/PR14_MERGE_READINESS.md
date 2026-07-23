# PR #14 - cổng review trước merge

PR giữ trạng thái **Draft** cho đến khi toàn bộ cổng dưới đây được xác minh trên cùng head SHA.

## Lỗi production đã xử lý

- Job xóa salon lưu snapshot UID trước khi xóa, xóa Auth trước dữ liệu và có thể retry theo từng phase.
- Job không thể `completed` khi còn `authFailedUids`; UID không tồn tại được xử lý idempotent.
- Admin Web khởi tạo App Check an toàn; debug token không được bật trong production.
- Manager luôn yêu cầu ẩn splash, có timeout, lỗi tiếng Việt, request ID an toàn và nút thử lại.
- Admin Web/API client chỉ đọc; callable ghi mặc định trả `ADMIN_WRITE_DISABLED`.
- Manager dùng env/Firebase runtime riêng; phụ thuộc source UI tạm thời được ghi tại `MANAGER_EXTRACTION.md`.

## Cổng còn phải xác minh trên GitHub

- [ ] Build, Lighthouse và CodeQL xanh trên head SHA mới nhất.
- [ ] `Manager Android` chạy test, lint và `assembleDebug` thành công.
- [ ] `Manager iOS Simulator` build thành công với `CODE_SIGNING_ALLOWED=NO`.
- [ ] Repository check xác nhận không có Firebase native config, signing key hoặc provisioning profile.
- [ ] Có ít nhất một review độc lập; không dùng chính mô tả PR làm bằng chứng kiểm thử.

## Chưa được thực hiện

- Không deploy Firebase hoặc Zalo.
- Không chạy migration production.
- Không bật `ADMIN_WRITE_OPERATIONS_ENABLED`.
- Không phát hành TestFlight/Google Play.
- Không chuyển PR sang Ready hoặc merge chỉ vì CI xanh.
