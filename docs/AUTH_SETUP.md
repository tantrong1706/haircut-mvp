# Owner/Staff Auth Setup

The customer page still runs as an internal-test flow, but staff and owner pages now require Firebase Auth plus a `users/{uid}` profile document.

## Enable Firebase Auth

1. Open Firebase Console.
2. Select project `haircut-c7d12`.
3. Go to Authentication > Sign-in method.
4. Enable Email/Password.

## Create Owner Account

1. Go to Authentication > Users.
2. Add a user with owner email and password.
3. Copy the new Firebase Auth UID.
4. Go to Firestore Database.
5. Create document `users/{uid}` with:

```json
{
  "salonId": "demo-salon",
  "name": "Chu salon",
  "role": "owner",
  "isActive": true
}
```

## Create Staff Account

Create another Firebase Auth user, copy that UID, then create `users/{uid}`:

```json
{
  "salonId": "demo-salon",
  "name": "Nhan vien",
  "role": "staff",
  "isActive": true
}
```

## Access Rules

- `/owner?salonId=demo-salon`: owner only.
- `/staff?salonId=demo-salon`: owner or staff.
- Inactive users cannot access owner/staff screens.

## Firestore Rules Warning

Do not deploy `firebase/firestore.rules.production.example` yet. It is a production draft for after the customer/Zalo auth flow is implemented. The current live `firebase/firestore.rules` file remains open so the customer MVP can still create customers and chair sessions during internal testing.
