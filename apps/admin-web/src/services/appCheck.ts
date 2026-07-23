export type AdminAppCheckStatus =
  | { enabled: true; debugMode: boolean }
  | { enabled: false; reason: "missing_site_key" | "initialization_failed" };

type DebugGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
};

export function initializeAdminAppCheck<TApp, TProvider>(input: {
  app: TApp;
  siteKey: string;
  debugToken?: string;
  production: boolean;
  createProvider: (siteKey: string) => TProvider;
  initialize: (app: TApp, provider: TProvider) => void;
  debugGlobal?: DebugGlobal;
}): AdminAppCheckStatus {
  const siteKey = input.siteKey.trim();
  if (!siteKey) return { enabled: false, reason: "missing_site_key" };

  const debugToken = String(input.debugToken || "").trim();
  const debugMode = !input.production && Boolean(debugToken);
  if (debugMode) {
    const target = input.debugGlobal ?? (globalThis as DebugGlobal);
    target.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
  }

  try {
    input.initialize(input.app, input.createProvider(siteKey));
    return { enabled: true, debugMode };
  } catch {
    return { enabled: false, reason: "initialization_failed" };
  }
}

export function adminAppCheckErrorMessage(error: unknown) {
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record?.code || "").toLowerCase();
  const message = String(record?.message || "").toLowerCase();
  if (code.includes("app-check") || message.includes("app check") || message.includes("appcheck")) {
    return "Admin chưa vượt qua kiểm tra bảo mật thiết bị. Kiểm tra cấu hình App Check rồi thử lại.";
  }
  return "";
}
