# Firebase Backend

## Setup

```bash
cd haircut/firebase
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `your-firebase-project-id`.

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
```

Install functions dependencies:

```bash
cd functions
npm install
npm run build
```

Configure Zalo Mini App ID:

```bash
cp functions/.env.example functions/.env
```

Edit `functions/.env` and set `ZALO_MINI_APP_ID`.

Deploy:

```bash
cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

## Local Emulator Demo

Terminal 1:

```powershell
.\scripts\start-emulators.ps1
```

Terminal 2:

```powershell
.\scripts\seed-demo.ps1
```

## Production Notes

- Verify Zalo identity server-side before trusting `zaloUserId`.
- Replace the placeholder Mini App URL in `miniAppUrl`.
- Add scheduled cleanup for old `chair_sessions`.
- Add App Check before public testing.
