# Implementation Plan

## Phase 1: Foundation

- Create Firebase project.
- Enable Authentication.
- Enable Firestore.
- Enable Storage.
- Deploy rules.
- Deploy Cloud Functions.
- Create first owner account manually or through `createSalon`.
- Create first salon.

## Phase 2: iOS Owner/Staff App

- Create Xcode SwiftUI app named `Haircut`.
- Add Firebase SDK.
- Add source files from `ios-app/Haircut`.
- Configure `GoogleService-Info.plist`.
- Test owner/staff role routing.
- Test dashboard, pending requests, staff active sessions.

## Phase 3: Zalo Mini App

- Create Zalo Mini App in Zalo developer console.
- Configure required scopes.
- Use `getUserInfo` for Zalo identity.
- Ask phone only when needed and explain why.
- Connect React app to Firebase Functions.
- Configure QR URL format.

## Phase 4: QR + Chair Session

- Owner creates mirror records.
- Backend creates `qrToken` and `qrUrl`.
- QR opens Mini App with `salonId`, `mirrorId`, `qrToken`.
- Customer scans QR.
- Backend verifies mirror token.
- Backend creates/updates customer profile.
- Backend creates active chair session.
- Staff app listens to active sessions in realtime.

## Phase 5: Notes, Photos, Points

- Staff opens customer session.
- Staff adds haircut note.
- Staff uploads photo only if customer consented.
- Staff submits point request.
- Owner approves.
- Backend creates haircut history and increments customer points.

## Phase 6: Lucky Wheel

- Owner configures 6 slots.
- Customer can spin only if enough points.
- Backend performs random selection.
- Backend creates reward code.
- Owner/staff marks reward used.

## Phase 7: Trial With One Salon

Test with:

- 1 owner.
- 2 staff.
- 3 mirrors.
- 20 customers.
- 10 point approvals.
- 5 wheel spins.
- 3 redeemed rewards.

Track:

- Can customers scan QR without staff help?
- Can staff find current customer quickly?
- Does owner trust approval workflow?
- Is phone number required too early?
- Are haircut notes useful on return visit?

