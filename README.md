# HAIRCUT MVP

HAIRCUT is a salon loyalty product with one iOS app for owners/staff and one Zalo Mini App for customers.

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
haircut/
  docs/                 Product spec, database, roadmap, privacy checklist
  firebase/             Firestore rules, Storage rules, Cloud Functions
  ios-app/              SwiftUI source for owner/staff app
  zalo-mini-app/        React/TypeScript source for customer Mini App
```

## MVP Modules

- `firebase`: backend logic for salon setup, mirror QR, chair sessions, point approval, lucky wheel, reward redemption.
- `ios-app`: SwiftUI screens for owner dashboard, pending approvals, staff serving workflow, customers, wheel setup.
- `zalo-mini-app`: customer flow for scan QR, Zalo identity, profile, points, haircut history, wheel, rewards.

## Recommended Build Order

1. Create Firebase project.
2. Deploy Firestore/Storage rules.
3. Deploy Cloud Functions.
4. Create the iOS app in Xcode and add the SwiftUI source.
5. Create the Zalo Mini App and connect the React app to Firebase Functions.
6. Test with one real salon and three mirror QR codes.

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

Firebase deploy after login:

```powershell
.\scripts\firebase-login.ps1
.\scripts\set-firebase-project.ps1 -ProjectId your-firebase-project-id
.\scripts\deploy-firebase.ps1
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

## Current Status

This repository contains the MVP foundation and implementation skeleton. You still need real Firebase config files and real Zalo app credentials before production testing.
