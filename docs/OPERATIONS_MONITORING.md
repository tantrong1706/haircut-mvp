# Giám sát HAIRCUT

Tài liệu này mô tả tín hiệu cần theo dõi khi chạy pilot và production. Quy trình backup, restore và rollback chi tiết nằm tại `docs/PRODUCTION_OPERATIONS.md`.

## Nguồn giám sát

### Firebase và Google Cloud

- Hosting: trạng thái release và lỗi phân phối tài nguyên.
- Cloud Functions: tỷ lệ lỗi, độ trễ p95, cold start, số lần gọi và retry.
- Firestore: reads/writes, lỗi Rules, index, quota và dung lượng.
- Authentication: lỗi đăng nhập, tài khoản bị khóa và hoạt động bất thường.
- Storage: dung lượng ảnh, lỗi quyền và egress.
- App Check: tỷ lệ request hợp lệ trước khi bật enforce.
- Cloud Logging/Error Reporting: lỗi backend theo function, `requestId` và `salonId` đã làm sạch.

### Sentry frontend

Biến cấu hình chỉ ghi trong môi trường deploy, không commit giá trị thật:

```text
VITE_SENTRY_DSN
VITE_SENTRY_TRACES_SAMPLE_RATE
VITE_SENTRY_REPLAY_SAMPLE_RATE=0
VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=0
```

Không bật Session Replay cho dữ liệu khách. Cơ chế scrub phải loại token, QR token, số điện thoại, email, tên khách, ghi chú và URL ảnh trước khi gửi.

### Uptime monitor

Theo dõi tối thiểu:

```text
https://haircut-c7d12.web.app/health.json
```

Kỳ vọng HTTP `200` và body có `"status": "ok"`. Nên có thêm synthetic check cho `/privacy`, `/terms` và callable health trên staging nếu được triển khai.

## Chỉ số và cảnh báo đề xuất

| Tín hiệu | Cảnh báo ban đầu |
| --- | --- |
| Hosting/health thất bại | 2 lần liên tiếp trong 5 phút |
| Callable lỗi 5xx | trên 2% trong 10 phút |
| Độ trễ callable p95 | trên 3 giây trong 15 phút |
| Check-in thất bại | tăng gấp 2 nền 7 ngày hoặc trên 5% |
| Duyệt điểm/đổi quà lỗi | trên 1% trong 15 phút |
| App Check invalid | tăng đột biến sau mỗi release |
| Firestore/Functions quota | đạt 80% giới hạn |
| Deletion job `failed` | có ít nhất 1 job |
| Push token lỗi lặp | trên 5% số lần gửi |

Các ngưỡng trên là điểm bắt đầu; điều chỉnh sau pilot dựa trên lưu lượng thật.

## Sự kiện sản phẩm tối thiểu

- Khách: bắt đầu/xong check-in, mở tab, quay và nhận kết quả.
- Nhân viên: nhận lượt, gửi yêu cầu điểm, tra cứu/đổi mã quà.
- Chủ salon: duyệt/từ chối điểm, quản lý chi nhánh/nhân viên/QR/vòng quay.
- Hệ thống: từ chối truy cập chéo tenant, khóa salon, deletion job và lỗi tác vụ nền.

Không dùng Analytics làm nguồn sự thật cho điểm hoặc phần thưởng. Dữ liệu nghiệp vụ trong Firestore và audit server-side mới là căn cứ đối soát.

## Quy tắc dữ liệu nhạy cảm

Không gửi vào log, Analytics, Sentry hoặc breadcrumb:

- access token, App Secret, appsecret proof và QR token;
- số điện thoại, email, Zalo ID hoặc tên khách đầy đủ;
- ghi chú kiểu tóc, mã quà đầy đủ và URL ảnh;
- payload webhook hoặc nội dung Firebase credential.

Cho phép các trường vận hành đã làm sạch như `salonId`, `branchId`, vai trò, tên function, mã lỗi ổn định, trạng thái và `requestId`.

## Nhịp vận hành

- Mỗi ngày pilot: xem health, lỗi mới, check-in, yêu cầu điểm và deletion jobs.
- Mỗi tuần: rà chi phí/quota, token push lỗi, audit truy cập bị từ chối và phiên bản app tối thiểu.
- Mỗi tháng: kiểm tra backup, diễn tập restore trên staging và rà quyền system admin.
- Sau mỗi release: theo dõi lỗi/độ trễ/App Check ít nhất 60 phút và chuẩn bị rollback theo release tag.
