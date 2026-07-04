# Gan tai khoan Firebase Console thanh chu salon

Neu ban chi moi tao user trong Firebase Console, app van chua biet user do la chu salon.
Can tao them ho so van hanh trong Firestore.

Cach nhanh nhat la chay script tren desktop:

```powershell
cd "C:\tantrong\haircut-mvp"
.\scripts\create-owner-profile.ps1
```

Script se hoi:

- email tai khoan Firebase Auth;
- mat khau tai khoan Firebase Auth;
- ten chu salon;
- ten salon;
- so dien thoai salon neu co.

Sau khi chay xong, script tu tao:

- `salons/{salonId}`;
- `users/{uid}` voi `role = owner`;
- `lucky_wheel/{salonId}`;
- `mirrors/{mirrorId}` cho Guong 1.

Sau do mo:

```text
https://haircut-c7d12.web.app/owner
```

Dang nhap bang email va mat khau da tao trong Firebase Console.

Neu quen mat khau, vao Firebase Console > Authentication > Users, dat lai mat khau
hoac tao user moi roi chay lai script.
