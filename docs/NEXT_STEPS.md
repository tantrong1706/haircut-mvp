# Next Steps

## What Exists Now

- Product spec.
- Firestore schema.
- Privacy checklist.
- Firebase rules.
- Cloud Functions for the core MVP flow.
- Zalo Mini App React source.
- SwiftUI iOS source for owner/staff workflows.

## What You Must Configure

1. Firebase project ID.
2. Firebase web app config for Zalo Mini App.
3. Firebase iOS config `GoogleService-Info.plist`.
4. Real Zalo Mini App ID.
5. Real Zalo phone token exchange endpoint.
6. App Store production login methods.

## First Real Test

1. Create owner Firebase Auth account.
2. Sign in from iOS app.
3. Create salon.
4. Create 3 mirror QR codes.
5. Print QR or open QR URL manually.
6. Customer scans QR in Zalo Mini App.
7. Staff sees active session.
8. Staff submits point request.
9. Owner approves.
10. Customer checks points and spins wheel.

## Local Demo Test

Use this when you want to test without a real Firebase project:

1. Open terminal 1.
2. Run `.\scripts\start-emulators.ps1`.
3. Open terminal 2.
4. Run `.\scripts\seed-demo.ps1`.
5. Run `.\scripts\start-miniapp.ps1`.
6. Open `http://127.0.0.1:5173/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token`.

## Web MVP Test

1. Customer opens `/` and creates a chair session.
2. Staff opens `/staff?salonId=demo-salon`.
3. Staff selects the waiting customer and submits a haircut note.
4. Owner opens `/owner?salonId=demo-salon`.
5. Owner approves the point request.
6. Customer opens history and sees the haircut record.
7. Customer reaches 5 points and tests lucky wheel.
