# Photo Pipeline Hardening

## Phạm vi

Thay đổi này chỉ củng cố luồng ảnh kiểu tóc hiện có. Không thêm nghiệp vụ sản phẩm, không thay đổi chính sách đồng ý lưu ảnh và không chạy migration production.

## Luồng dữ liệu

Luồng mới:

1. Nhân viên hoặc chủ salon chụp/chọn ảnh.
2. Ứng dụng kiểm tra magic bytes JPEG/PNG/WebP, kích thước nguồn và số megapixel.
3. Ảnh chỉ được preview; chưa upload cho tới khi người dùng bấm xác nhận.
4. Worker xử lý orientation, resize tối đa 2048 px, nén JPEG và tái mã hóa để loại EXIF/GPS. WebView thiếu Worker dùng fallback có timeout trên main thread.
5. Client gọi `beginHaircutPhotoUpload` với `requestId`, checksum và kích thước ảnh đã xử lý.
6. Backend tạo operation idempotent và đường dẫn Storage cố định.
7. Client upload resumable với progress, cancel, timeout và exponential backoff.
8. Client gọi `finalizeHaircutPhotoUpload`.
9. Backend kiểm tra lại user, salon, branch, session, người phụ trách, consent, MIME/size/metadata, magic bytes JPEG và SHA-256 thực tế.
10. Khi gửi yêu cầu điểm, operation được gắn vào point request trong transaction.

Không lưu ảnh base64, QR token, download token hoặc signed URL vào localStorage.

## Operation và Storage

Collection: `photo_upload_operations/{operationId}`.

Các trạng thái: `pending`, `uploading`, `uploaded`, `finalized`, `cancelled`, `expired`, `failed`.

Đường dẫn mới:

```text
salons/{salonId}/customers/{customerId}/sessions/{sessionId}/{operationId}.jpg
```

Operation chứa tenant/session ownership, `requestId`, `staffUid`, checksum, content type, giới hạn byte, consent version, thời hạn và trạng thái attachment. Client không được tự chọn đường dẫn.

Storage Rules chỉ cho tạo object đúng operation chưa hết hạn. Update và delete trực tiếp bị chặn; việc xóa đi qua backend để giới hạn đúng prefix.

## Bảo mật và quyền riêng tư

- Consent được kiểm tra tại cả begin và finalize.
- Staff phải thuộc đúng salon/branch và đang phụ trách session `serving`.
- Owner chỉ bổ sung ảnh cho session `pending_approval` trong salon của mình.
- Backend đọc byte thật để xác minh JPEG và SHA-256; không tin extension hoặc metadata client.
- Audit chỉ ghi ID kỹ thuật, kích thước và kết quả; không ghi ảnh, URL, tên khách, số điện thoại hoặc ghi chú kiểu tóc.
- Operation cùng `requestId` trả cùng kết quả; finalize/cancel chạy lại an toàn.

## Retry, reload và cleanup

- Upload dùng tối đa 3 lần thử, exponential backoff có jitter, timeout và AbortSignal.
- Timeout sau commit được xử lý bằng begin/finalize idempotent.
- Sau reload, client gọi `getRecoverableHaircutPhotoUploads` để lấy tối đa 3 ảnh `finalized + unattached` đúng staff/session; URL được lấy lại qua Storage Rules.
- Scheduler xóa operation hết hạn và file finalized không được gắn sau thời gian an toàn.
- Session hết hạn, point request bị từ chối và customer deletion đều cleanup theo prefix tenant; thao tác xóa idempotent.

## Tương thích dữ liệu cũ

- Dữ liệu cũ tiếp tục đọc `photoUrls`.
- Dữ liệu mới ghi `photoPaths`; API trả URL tạm khi cần hiển thị.
- Không backfill và không xóa URL/file cũ trong PR này.
- Ảnh mới đã được resize thành display asset và dùng `loading="lazy"`; chưa tạo một object thumbnail riêng.

## Migration và rollback

Migration production: **không có**.

Trước khi phát hành cần deploy đồng bộ Functions, Firestore indexes, Firestore Rules và Storage Rules. Không bật client mới khi callable/index/rules mới chưa sẵn sàng.

Rollback:

1. Rollback client về bản trước.
2. Giữ Functions/Rules mới để dữ liệu `photoPaths` vẫn đọc được và cleanup tiếp tục chạy.
3. Không xóa collection operation hoặc object mới.
4. Chỉ rollback backend sau khi xác minh không còn client mới đang hoạt động.

## Giới hạn đã biết

- HEIC/HEIF được nhận diện và trả lỗi rõ ràng; chưa chuyển đổi vì repository chưa có bộ chuyển đổi đã kiểm chứng trên Android/iPhone/Zalo WebView.
- Browser không luôn phân biệt được từ chối camera tạm thời và vĩnh viễn. UI vẫn giữ lựa chọn thư viện và hướng dẫn mở cài đặt khi trạng thái `denied` được API cung cấp.
- Chưa có object thumbnail 512 px riêng; danh sách dùng ảnh đã chuẩn hóa và lazy loading. Việc thêm thumbnail cần một PR hiệu năng riêng nếu số ảnh thực tế làm tăng băng thông.

## Checklist thiết bị thật

Trạng thái hiện tại của toàn bộ mục dưới đây: **NOT RUN**.

### Android

- Cấp quyền, từ chối và từ chối vĩnh viễn camera.
- Chụp dọc/ngang và ảnh độ phân giải cao.
- Chọn ảnh thư viện.
- Mất mạng, cancel, retry, background/resume và reload sau finalize.

### iPhone

- Camera permission và Limited Photos.
- JPEG, HEIC error path, orientation và memory pressure.
- Mạng chậm, background/resume và safe area.

### Zalo Mini App/web

- Camera/file picker trên runtime được hỗ trợ và runtime không hỗ trợ.
- Refresh giữa upload, timeout sau upload/finalize và đổi Zalo identity.
- Xác nhận telemetry/log không chứa URL token hoặc dữ liệu khách.
