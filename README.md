# HAIRCUT MVP

HAIRCUT is a salon loyalty product for hair salons. The current MVP is a Firebase-hosted web/Zalo Mini App flow with customer, staff, and owner screens.

Core idea:

1. Owner creates a salon.
2. Owner creates QR codes for mirrors/chairs.
3. Customer scans the mirror QR with Zalo.
4. Zalo Mini App creates or finds the customer profile.
5. Staff sees the customer in the iOS app.
6. Staff adds haircut notes/photos and requests points.
7. Owner approves points.
8. Customer uses points for a lucky wheel reward.

## Folder Structure

```text
haircut-mvp/
  docs/                 Product spec, database, roadmap, privacy checklist
  firebase/             Firestore rules, Hosting build, optional Functions/Storage config
  ios-app/              SwiftUI source for future owner/staff iOS app
  zalo-mini-app/        React/TypeScript source for customer/staff/owner web app
```

## MVP Modules

- `firebase`: Firestore rules/indexes and Firebase Hosting output. Storage is optional and currently not deployed unless Blaze is enabled.
- `zalo-mini-app`: current MVP web app for customer scan flow, staff requests, owner approvals, wheel config, and privacy page.
- `ios-app`: future SwiftUI owner/staff app source. It still requires Mac/Xcode and Firebase iOS config.

## Recommended Build Order

1. Test the current web MVP flow end to end.
2. Configure lucky wheel in `/owner`.
3. Add owner/staff authentication and role checks.
4. Replace open Firestore test rules with production rules.
5. Create the real Zalo Mini App.
6. Build the iOS owner/staff app later on Mac/Xcode.

## Windows Automation

Run from the `haircut-mvp` folder:

```powershell
.\scripts\setup.ps1 -InstallFirebaseCli
.\scripts\start-miniapp.ps1
```

Local demo with Firebase Emulator:

```powershell
.\scripts\start-emulators.ps1
.\scripts\seed-demo.ps1
```

Firebase deploy after login. Current MVP should deploy Firestore + Hosting only:

```powershell
.\scripts\firebase-login.ps1
.\scripts\set-firebase-project.ps1 -ProjectId your-firebase-project-id
.\scripts\deploy-firebase.ps1
```

Do not deploy Storage unless the Firebase project has Blaze enabled:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeStorage
```

Deploy Functions only when the app is moved back to server-side business logic:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeFunctions
```

Deploy only the web app after UI changes:

```powershell
.\scripts\deploy-hosting.ps1
```

Useful test URLs:

```text
https://haircut-c7d12.web.app
https://haircut-c7d12.web.app/staff?salonId=demo-salon
https://haircut-c7d12.web.app/owner?salonId=demo-salon
https://haircut-c7d12.web.app/privacy
```

Owner/staff routes now require Firebase Auth plus a `users/{uid}` role document. See `docs/AUTH_SETUP.md`.

## Current Status

This repository contains an internal-test MVP. Firestore rules are intentionally open for testing right now and must be locked before real salon/customer usage.
