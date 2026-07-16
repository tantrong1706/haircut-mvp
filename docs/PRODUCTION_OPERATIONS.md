# Vận hành production HAIRCUT

## Cổng trước phát hành

1. Working tree sạch, CI xanh, release SHA và người phê duyệt đã ghi nhận.
2. `scripts/backup-firestore.ps1` đã export thành công trước migration/thay đổi Rules.
3. `audit:tenant-data` không còn document nghiệp vụ thiếu `salonId`, hoặc đã có mapping được duyệt.
4. Deploy Functions tương thích trước, sau đó indexes, Rules, Hosting và Zalo/Manager.
5. Smoke test salon demo; không dùng dữ liệu khách thật để diễn tập.

## Backup và restore

Dry-run export:

```powershell
.\scripts\backup-firestore.ps1 -ProjectId haircut-c7d12 -Bucket gs://YOUR_BACKUP_BUCKET
```

Chỉ thêm `-Execute` sau khi kiểm tra project/bucket. Restore luôn chạy dry-run trước; import Firestore là thao tác gộp và không xóa document mới hơn backup.

```powershell
.\scripts\restore-firestore.ps1 `
  -ProjectId haircut-c7d12 `
  -ConfirmProject haircut-c7d12 `
  -Source gs://YOUR_BACKUP_BUCKET/firestore/EXPORT_PATH
```

Diễn tập restore hàng quý với dữ liệu giả. Ghi RPO, RTO, số document/ảnh trước-sau và kết quả smoke test.

## Monitoring và cảnh báo

- Uptime: `https://haircut-c7d12.web.app/health.json`, chu kỳ 1-5 phút.
- Functions: cảnh báo error rate, timeout, instance/quota và log theo `errorCode`.
- Firestore/Storage: cảnh báo read/write, egress và dung lượng tăng bất thường.
- Billing: budget alerts 50%, 80%, 100% và anomaly notification.
- Product health: check-in lỗi, point request chờ lâu, session mở quá hạn, mã quà lỗi và app version cũ.

Không gửi tên, phone/email đầy đủ, ghi chú, ảnh, reward code, QR/Zalo/Firebase token vào log hoặc monitoring.

## Công tắc khẩn cấp

`system_config/features` và `salons/{salonId}/settings/features` có thể tắt riêng check-in, vòng quay, đổi quà, upload ảnh hoặc duyệt điểm. Dùng `maintenanceMode` chỉ khi cần dừng các thao tác ghi; ghi rõ lý do và audit trước khi bật lại.

## Rollback

- Hosting: rollback release trong Firebase Hosting history.
- Functions: checkout tag ổn định và deploy theo nhóm nhỏ; giữ code tương thích dữ liệu mới.
- Rules: không hạ Rules nếu việc đó mở quyền; ưu tiên forward fix.
- Firestore: restore vào môi trường phục hồi/dữ liệu giả để kiểm đếm trước production.
- Manager/Zalo: dừng rollout, giữ TestFlight/Internal/Testing version trước và bật feature flag nếu cần.

Mọi sự cố phải ghi thời điểm, release SHA, tenant bị ảnh hưởng, error code, thao tác giảm thiểu và người kết thúc sự cố.
