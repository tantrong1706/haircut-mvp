# App Store Guide

This project is not ready for App Store submission yet. Use this checklist after the web MVP flow is stable.

## Requirements

- Mac or Mac cloud.
- Xcode.
- Apple ID.
- Apple Developer Program membership.
- App Store Connect access.
- Firebase iOS config file: `GoogleService-Info.plist`.
- App icon, screenshots, support URL, and privacy policy URL.

Apple Developer Program is required for TestFlight and App Store distribution.

## Recommended Bundle ID

```text
com.tantrong.haircut
```

Use the same Bundle ID in:

- Xcode target settings.
- Apple Developer Identifiers.
- Firebase iOS app config.

## iOS Login Recommendation

For the first iOS version, keep the iOS app for owner/staff only.

Recommended login order:

1. Email/password for owner and staff.
2. Sign in with Apple before App Store release if third-party login is added.
3. Zalo login later.

Customers should keep using the Zalo Mini App and should not be forced to install the iOS app.

## App Store Metadata

Suggested app name:

```text
HAIRCUT
```

Suggested subtitle:

```text
Chăm sóc khách hàng salon tóc
```

Suggested category:

```text
Business
```

Suggested description:

```text
HAIRCUT giúp salon tóc quản lý hồ sơ khách hàng, lưu lịch sử kiểu tóc,
tích điểm, duyệt điểm nhân viên và chăm sóc khách bằng QR/Zalo.
```

Privacy Policy URL:

```text
https://haircut-c7d12.web.app/privacy
```

## TestFlight Flow

1. Build the iOS app in Xcode.
2. Product -> Archive.
3. Distribute App -> App Store Connect.
4. Wait for build processing.
5. Add internal or external testers in TestFlight.
6. Test owner/staff workflows on a real iPhone.
7. Fix issues and upload a new build.
8. Submit for App Review only after TestFlight is stable.

## Review Notes Template

```text
This app is for salon owners and staff.

Test account:
Email:
Password:

Test flow:
1. Sign in.
2. Open waiting customers.
3. Submit haircut note and point request.
4. Owner approves the point request.
5. Check customer history and points.
```

