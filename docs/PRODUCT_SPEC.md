# HAIRCUT Product Spec

## Positioning

HAIRCUT helps hair salons turn walk-in customers into repeat customers by storing haircut history, awarding points, and giving rewards through a Zalo Mini App.

The app is not mainly an HR system. Staff management exists only to support the salon workflow.

## Main Decision

Use QR codes per salon mirror/chair, not per customer.

Why:

- Customers do not need to keep a personal QR.
- Owners do not need to print a QR for every customer.
- Staff do not need to search for a customer's QR.
- First-time customers can join naturally by scanning the mirror QR.

## Systems

### iOS App

One iOS app for both owner and staff.

Owner role:

- Create and manage salon.
- Add or disable staff.
- Configure points.
- Configure lucky wheel.
- Create mirror QR codes.
- Approve point requests.
- View customers and reports.

Staff role:

- See customers currently being served.
- View customer name and last 4 digits of phone.
- View haircut history for the selected customer.
- Take photos only if customer allows it.
- Add haircut notes.
- Submit point requests.
- Mark rewards as used if owner allows it.

### Zalo Mini App

Customer does not install iOS/Android app.

Customer can:

- Scan mirror QR with Zalo.
- Continue with Zalo identity.
- Confirm name and optional phone number.
- Allow or deny haircut photo storage.
- View points.
- View haircut history.
- Spin lucky wheel when eligible.
- View rewards.

## Primary Flow

Owner:

1. Opens HAIRCUT iOS app.
2. Signs in.
3. Creates salon.
4. Adds staff.
5. Configures point rule.
6. Configures 6-slot lucky wheel.
7. Creates QR code for each mirror.
8. Prints and sticks QR to mirrors.

Customer first visit:

1. Customer sits at a mirror.
2. Customer scans mirror QR in Zalo.
3. Zalo Mini App opens.
4. Customer confirms Zalo identity.
5. Customer optionally shares phone number.
6. Customer chooses whether salon may store haircut photos.
7. System creates customer profile.
8. Staff app shows customer at that mirror.

Customer return visit:

1. Customer scans mirror QR.
2. System identifies customer by Zalo user ID.
3. Staff app shows current points and haircut history.
4. Staff can reuse previous notes.

Staff service:

1. Staff opens "Khach dang phuc vu".
2. Staff selects the customer session.
3. Staff adds notes.
4. Staff takes photos only if allowed.
5. Staff submits point request.

Owner approval:

1. Owner receives pending request.
2. Owner reviews customer, staff, notes, photos, points.
3. Owner approves or rejects.
4. On approval, system adds points and creates haircut history.

Lucky wheel:

1. Customer opens Zalo Mini App.
2. Customer opens lucky wheel.
3. Backend checks points.
4. Backend randomly picks one of 6 slots.
5. Backend creates reward code.
6. Backend deducts points if salon configured deduction.

## MVP Scope

Build first:

- Owner/staff login foundation.
- Salon creation.
- Staff profile.
- Mirror QR creation.
- Customer profile from Zalo.
- Active chair sessions.
- Haircut notes/photos.
- Point request.
- Owner approval.
- Customer points.
- Haircut history.
- 6-slot lucky wheel.
- Reward code.

Do not build first:

- Android app.
- AI hairstyle suggestions.
- Multi-branch salon management.
- Automated customer reactivation messages.
- Payment/subscription collection.
- Customer username/password accounts.
- Personal QR per customer.

