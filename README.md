# HAIRCUT

HAIRCUT là hệ thống chăm sóc và giữ chân khách hàng cho salon tóc. Khách check-in bằng QR/Zalo Mini App; nhân viên vận hành hàng chờ theo chi nhánh; chủ salon duyệt điểm, quản lý chi nhánh, nhân viên, khách, vòng quay và mã quà.

## Luồng chính

1. Chủ đăng ký tại `/owner`, xác minh email rồi đăng nhập để tạo salon và chi nhánh chính.
2. Mỗi salon có một QR chung; mỗi chi nhánh có một QR riêng. Chủ phân công nhân viên theo chi nhánh.
3. QR salon cho khách chọn chi nhánh, hoặc tự chọn khi chỉ có một chi nhánh hoạt động; QR chi nhánh mở thẳng đúng địa điểm.
4. Khách xác nhận thông tin và tạo lượt; nhân viên tại chi nhánh đó nhận khách, ghi chú và gửi yêu cầu cộng điểm.
5. Chủ xem toàn salon hoặc lọc theo chi nhánh để duyệt/từ chối; khách thấy điểm, lịch sử và quà được cập nhật.

Salon của owner/staff luôn lấy từ tài khoản Firebase Auth, không lấy từ URL. Dữ liệu khách và mọi nghiệp vụ ghi đều đi qua Cloud Functions; Firestore Rules mặc định từ chối truy cập ngoài quyền được cấp.

Luồng lượt cắt dùng các trạng thái rõ ràng: `waiting → serving → pending_approval → completed/cancelled`. Phiên có hạn sử dụng, hỗ trợ hủy/no-show và được dọn tự động; Functions ràng buộc chỉ nhân viên đã nhận khách mới được gửi yêu cầu điểm. Ô `no_prize` của vòng quay chỉ ghi nhận lượt quay, không sinh mã quà.

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
