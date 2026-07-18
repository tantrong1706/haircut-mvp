export type ManagerAppCheckStatus =
  | { enabled: true; debugMode: boolean }
  | {
      enabled: false;
      reason: "native_runtime" | "missing_site_key" | "initialization_failed";
    };

type DebugGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
};

export function initializeManagerWebAppCheck<TApp, TProvider>(input: {
  app: TApp;
  siteKey: string;
  debugToken?: string;
  production: boolean;
  nativeRuntime: boolean;
  createProvider: (siteKey: string) => TProvider;
  initialize: (app: TApp, provider: TProvider) => void;
  debugGlobal?: DebugGlobal;
}): ManagerAppCheckStatus {
  if (input.nativeRuntime) {
    return { enabled: false, reason: "native_runtime" };
  }

  const siteKey = input.siteKey.trim();
  if (!siteKey) {
    return { enabled: false, reason: "missing_site_key" };
  }

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

export function managerAppCheckErrorMessage(error: unknown) {
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record?.code || "").toLowerCase();
  const message = String(record?.message || "").toLowerCase();
  if (code.includes("app-check") || message.includes("app check") || message.includes("appcheck")) {
    return "Thiết bị chưa vượt qua kiểm tra bảo mật. Vui lòng kiểm tra kết nối rồi thử lại.";
  }
  return "";
}

type AppCheckRegistry = typeof globalThis & {
  __haircutAppCheckApps?: Set<string>;
};

export function markFirebaseAppCheckInitialized(appName: string) {
  const target = globalThis as AppCheckRegistry;
  target.__haircutAppCheckApps ??= new Set<string>();
  target.__haircutAppCheckApps.add(appName);
}

export function isFirebaseAppCheckInitialized(appName: string) {
  return (globalThis as AppCheckRegistry).__haircutAppCheckApps?.has(appName) === true;
}
