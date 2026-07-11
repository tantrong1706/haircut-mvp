# HAIRCUT

HAIRCUT là hệ thống chăm sóc và giữ chân khách hàng cho salon tóc. Khách check-in bằng QR/Zalo Mini App; nhân viên ghi nhận dịch vụ; chủ salon duyệt điểm, quản lý gương, nhân viên, khách, vòng quay và mã quà.

## Luồng chính

1. Chủ salon đăng ký tại `/owner`; hệ thống tạo salon, hồ sơ owner, gương đầu tiên và vòng quay mặc định.
2. Chủ tạo QR riêng cho từng gương/ghế và gửi lời mời để nhân viên tự đặt mật khẩu.
3. Khách quét QR trong Zalo, xác nhận tên và tạo lượt cắt.
4. Nhân viên mở `/staff`, nhận khách, hoàn tất dịch vụ, ghi chú và gửi yêu cầu cộng điểm.
5. Chủ duyệt hoặc từ chối; khách tự thấy trạng thái, điểm, lịch sử và quà được cập nhật.

Salon của owner/staff luôn lấy từ tài khoản Firebase Auth, không lấy từ URL. Dữ liệu khách và mọi nghiệp vụ ghi đều đi qua Cloud Functions; Firestore Rules mặc định từ chối truy cập ngoài quyền được cấp.

Luồng lượt cắt dùng các trạng thái rõ ràng: `waiting → serving → pending_approval → completed/cancelled`. Functions ràng buộc chỉ nhân viên đã nhận khách mới được gửi yêu cầu điểm; API khách Zalo có hạn mức chống spam theo token/IP đã băm.

## Địa chỉ

- Khách: <https://haircut-c7d12.web.app>
- Chủ salon: <https://haircut-c7d12.web.app/owner>
- Nhân viên: <https://haircut-c7d12.web.app/staff>
- Quyền riêng tư: <https://haircut-c7d12.web.app/privacy>
- Zalo Mini App: <https://zalo.me/s/2038116772828167300>

## Cấu trúc

```text
firebase/          Rules, indexes, Storage và Cloud Functions
zalo-mini-app/     React + TypeScript cho khách, owner và staff
scripts/           Build, deploy và kiểm tra production
docs/              Kiến trúc, triển khai và xử lý sự cố
ios-app/           Source chuẩn bị cho giai đoạn iOS sau
```

## Kiểm tra

Yêu cầu Node.js 22 cho CI và Functions.

```powershell
cd C:\tantrong\haircut-mvp\zalo-mini-app
npm ci
npm run check

cd ..\firebase\functions
npm ci
npm run check
```

Kiểm thử Rules chạy bằng Firebase Emulator và không chạm dữ liệu thật:

```powershell
cd C:\tantrong\haircut-mvp\firebase
firebase emulators:exec --project demo-haircut --only firestore,storage "npm --prefix functions run test:rules"
```

## Build và deploy

Production bắt buộc `VITE_FUNCTION_WRITE_MODE=required`. Build sẽ dừng ngay nếu biến môi trường Firebase/Zalo thiếu hoặc sai.

```powershell
cd C:\tantrong\haircut-mvp
.\scripts\check-production-readiness.ps1 -RunBuild -CheckLiveUrls
.\scripts\deploy-firebase.ps1 -IncludeFirestore -IncludeFunctions -IncludeStorage

cd .\zalo-mini-app
npm run deploy:zmp:test
```

`npm run build` tự đọc Vite manifest, cập nhật `app-config.json` và kiểm tra mọi asset Zalo. Không sửa tên file hash bằng tay.

Chi tiết môi trường, Secret Manager, Sentry source maps và rollback nằm trong [docs/deployment.md](docs/deployment.md). Chính sách báo lỗi bảo mật nằm trong [SECURITY.md](SECURITY.md).
