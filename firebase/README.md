# Firebase Backend

## Thiết Lập

```bash
cd haircut/firebase
cp .firebaserc.example .firebaserc
```

Sửa `.firebaserc` và thay `your-firebase-project-id` bằng project thật.

Cài Firebase CLI nếu máy chưa có:

```bash
npm install -g firebase-tools
firebase login
```

Chỉ cài thư viện Functions khi cần sửa Cloud Functions:

```bash
cd functions
npm install
npm run build
```

Cấu hình Zalo Mini App ID và App Secret nếu dùng Functions:

```bash
cp functions/.env.example functions/.env
```

Sửa `functions/.env`:

```env
ZALO_MINI_APP_ID=your-mini-app-id
ZALO_APP_SECRET=your-zalo-app-secret
```

`ZALO_APP_SECRET` bắt buộc cho luồng khách thật vì Functions phải xác minh `zaloAccessToken` với Zalo Open API trước khi suy ra `zaloUserId`.

## Deploy Khuyến Nghị

Trong giai đoạn chưa deploy Functions, chỉ deploy hosting:

```powershell
.\scripts\deploy-firebase.ps1 -OnlyHosting
```

Khi chuyển web app sang `VITE_FUNCTION_WRITE_MODE=required`, cần deploy Functions trước rồi mới deploy rules:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeFunctions
.\scripts\deploy-firebase.ps1 -IncludeFirestore
```

Chỉ deploy Storage khi Firebase project đã bật Storage/Blaze và bạn đã sẵn sàng dùng ảnh kiểu tóc:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeStorage
```

Không deploy full mặc định nếu project chưa bật Storage.

## Demo Bằng Emulator

Terminal 1:

```powershell
.\scripts\start-emulators.ps1
```

Terminal 2:

```powershell
.\scripts\seed-demo.ps1
```

## Ghi Chú Production

- Luồng khách Zalo gửi `zaloAccessToken`; Functions xác minh token ở server trước khi suy ra `zaloUserId`.
- Đặt `VITE_FUNCTION_WRITE_MODE=required` cho bản pilot thật.
- Deploy Firestore rules production trước khi mở cho khách thật.
- Storage rules chỉ cho upload ảnh dưới 5MB và chỉ khi khách đã bật `allowPhoto`.
- Thêm job dọn `chair_sessions` cũ khi salon bắt đầu dùng thường xuyên.
- Bật App Check trước khi public test rộng.
