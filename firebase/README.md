# Firebase Backend

## Thiết lập

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

Cấu hình Zalo Mini App ID nếu dùng Functions:

```bash
cp functions/.env.example functions/.env
```

Sửa `functions/.env` và đặt `ZALO_MINI_APP_ID`.

Triển khai MVP hiện tại:

```bash
cd ..
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Không triển khai Storage nếu Firebase project chưa nâng Blaze.
Không triển khai Functions nếu web app vẫn đang ghi Firestore trực tiếp.

Khi chuyển web app sang `VITE_FUNCTION_WRITE_MODE=required`, cần deploy Functions:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeFunctions
```

## Demo bằng Emulator

Terminal 1:

```powershell
.\scripts\start-emulators.ps1
```

Terminal 2:

```powershell
.\scripts\seed-demo.ps1
```

## Ghi chú production

- Xác minh Zalo identity ở server trước khi tin `zaloUserId`.
- Thay Mini App URL mẫu trong `miniAppUrl`.
- Thêm job dọn `chair_sessions` cũ.
- Bật App Check trước khi public test.
