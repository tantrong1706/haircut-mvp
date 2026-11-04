import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleAuth, OAuth2Client } from "google-auth-library";

const restConfigured = new WeakSet<object>();

function requireLocalHost(name: string, value: string | undefined): string {
  const host = String(value || "").trim();
  if (!host) {
    throw new Error(`${name} is required. Run the test through Firebase Emulator Suite.`);
  }

  const hostname = host.replace(/^\[/, "").split(/[\]:]/, 1)[0].toLowerCase();
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    throw new Error(`${name} must point to a local emulator.`);
  }

  return host;
}

function requireDemoProject(): string {
  const projectId = String(process.env.GCLOUD_PROJECT || "").trim();
  if (!projectId.startsWith("demo-")) {
    throw new Error("GCLOUD_PROJECT must use a demo-* project for emulator tests.");
  }
  return projectId;
}

export function requireFirestoreEmulator(): { emulatorHost: string; projectId: string } {
  const emulatorHost = requireLocalHost(
    "FIRESTORE_EMULATOR_HOST",
    process.env.FIRESTORE_EMULATOR_HOST,
  );
  const projectId = requireDemoProject();
  if (process.env.FIRESTORE_PREFER_REST === "true") {
    if (!getApps().length) initializeApp({ projectId });
    const db = getFirestore();
    if (!restConfigured.has(db)) {
      // The emulator's documented administrative token, not a real account credential.
      // REST fallback must not try ADC/metadata/OAuth against external services.
      const client = new OAuth2Client();
      client.setCredentials({ access_token: "owner", expiry_date: Date.now() + 3600000 });
      db.settings({ preferRest: true, auth: new GoogleAuth({ projectId, authClient: client }) });
      restConfigured.add(db);
    }
  }
  return { emulatorHost, projectId };
}

export function requireRulesEmulators(): { projectId: string } {
  requireLocalHost("FIRESTORE_EMULATOR_HOST", process.env.FIRESTORE_EMULATOR_HOST);
  requireLocalHost("FIREBASE_STORAGE_EMULATOR_HOST", process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  return { projectId: requireDemoProject() };
}
