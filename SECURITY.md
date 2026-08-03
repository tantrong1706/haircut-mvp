# Bảo mật

## Báo cáo lỗ hổng

Không đăng token, dữ liệu khách hoặc cách khai thác lên Issue công khai. Hãy liên hệ riêng chủ repo `tantrong1706` trên GitHub và cung cấp phạm vi ảnh hưởng, bước tái hiện cùng đề xuất khắc phục.

## Nguyên tắc

- Firestore mặc định từ chối; owner/staff chỉ đọc dữ liệu salon của mình.
- Khách được xác minh bằng Zalo Access Token ở Cloud Functions.
- Client không được tự cộng/trừ điểm, tạo quà hay đổi trạng thái phiên.
- Secret Zalo dùng Firebase Secret Manager.
- `.env.production`, service account và auth token không được commit. CI chạy
  `node scripts/check-secrets.mjs` và không in giá trị phát hiện.
- Dependabot và CodeQL theo dõi dependency/mã nguồn; không tự merge khi chưa qua test.
- `ENFORCE_APP_CHECK` bảo vệ callable nói chung; `REQUIRE_ZALO_APP_CHECK` là cổng
  bổ sung cho public endpoint Zalo. Chỉ bật enforcement sau monitor mode và kiểm
  tra thiết bị thật.

Các cảnh báo dependency bắc cầu chưa có bản vá tương thích được theo dõi qua
Dependabot và đánh giá lại mỗi tuần. Không hạ major hoặc dùng
`npm audit fix --force` để làm đẹp báo cáo.
