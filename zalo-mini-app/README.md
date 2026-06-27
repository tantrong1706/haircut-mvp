# HAIRCUT Zalo Mini App

Customer-facing Mini App.

## Development

```bash
cd haircut/zalo-mini-app
npm install
npm run dev
```

Open the URL with query parameters:

```text
http://localhost:5173/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token
```

If `.env` is missing, the app runs in mock mode so you can preview the UI flow.

## Connect Firebase

```bash
cp .env.example .env
```

Fill the Firebase web config values.

## Zalo Permissions

Use:

- `getUserInfo` to identify the customer.
- `getPhoneNumber` only after explaining why the phone number is helpful.

Do not force phone number on the first screen unless the salon requires it.

