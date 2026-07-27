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
  return {
    emulatorHost: requireLocalHost("FIRESTORE_EMULATOR_HOST", process.env.FIRESTORE_EMULATOR_HOST),
    projectId: requireDemoProject(),
  };
}

export function requireRulesEmulators(): { projectId: string } {
  requireLocalHost("FIRESTORE_EMULATOR_HOST", process.env.FIRESTORE_EMULATOR_HOST);
  requireLocalHost("FIREBASE_STORAGE_EMULATOR_HOST", process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  return { projectId: requireDemoProject() };
}
