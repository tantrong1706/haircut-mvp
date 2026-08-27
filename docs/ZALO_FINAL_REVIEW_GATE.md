# CH Haircut Salon — Final Zalo Review Gate

Đây là cổng quyết định duy nhất trước khi chủ dự án gửi Zalo Review. **check:zalo-review** chỉ kiểm tra source/artifact tĩnh và không được dùng để kết luận submission-ready.

## Một lệnh quyết định

```powershell
cd zalo-mini-app
npm run check:zalo-submission
```

Chỉ tiếp tục sang thao tác Submit Review khi lệnh in đúng:

```text
ZALO_SUBMISSION_READY=true
```

## Evidence duy nhất

1. Copy **docs/ZALO_SUBMISSION_EVIDENCE.example.json** thành **.tmp/zalo-submission-evidence.json**.
2. Chỉ ghi trạng thái boolean, SHA, Testing Version ID và checksum; không ghi token, HMAC, proof, QR token hoặc credential.
3. candidateSha, Firebase deployedSha và artifact SHA-256 phải thuộc cùng một ứng viên tích hợp PR #30 + PR #32.
4. Đủ 16 file PNG trong **docs/zalo-review-screenshots.local/**; popup **06-zalo-permission.png** phải chụp thủ công trên Zalo thật.

## Thứ tự đóng gate

1. Cập nhật PR #32 lên đúng HEAD PR #30 và chạy CI trên một SHA tích hợp.
2. Cài Gateway từ release versioned/checksummed dưới ProgramData; không chạy dist từ worktree dev.
3. Enforce HTTPS cho gateway.chhaircutsalon.cc, giữ Gateway bind 127.0.0.1:3000.
4. Chạy một signed real-Zalo test từ laptop Việt Nam; không log token/proof/full ID.
5. Sau khi real Zalo PASS, xin phép riêng để canary Firebase sang ZALO_VERIFIER_MODE=gateway; deployed SHA phải khớp candidate.
6. Tạo Zalo Testing Version cuối, kiểm tra Android và iPhone, chụp đúng 16 ảnh và xóa mọi placeholder.
7. Chạy lại cổng quyết định. Dừng trước Submit Review và Publish để chủ dự án phê duyệt.

## Safety mặc định

```text
Firebase production deployed: false
Zalo version deployed: false
Review submitted: false
Published: false
Router port forwarding: false
Real secrets committed: false
```
