import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializeAppCheck: vi.fn(),
  initializeApp: vi.fn((_options, name = "[DEFAULT]") => ({ name })),
  getApps: vi.fn(() => []),
  getAuth: vi.fn((app) => ({ app })),
  getFunctions: vi.fn((app) => ({ app })),
}));
vi.mock("firebase/app", () => ({ ...mocks, getApp: vi.fn() }));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class {
    constructor(public siteKey: string) {}
  },
}));
vi.mock("firebase/auth", () => ({ getAuth: mocks.getAuth }));
vi.mock("firebase/functions", () => ({ getFunctions: mocks.getFunctions, httpsCallable: vi.fn() }));
vi.mock("firebase/firestore", () => ({ getFirestore: vi.fn() }));
vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_FIREBASE_API_KEY", "public-fixture-key");
  vi.stubEnv("VITE_FIREBASE_APP_CHECK_SITE_KEY", "public-fixture-site-key");
  vi.stubGlobal("__haircutAppCheckApps", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Web App Check initialization", () => {
  it("initializes once per customer and manager app, before Firebase services", async () => {
    const api = await import("./firebase");
    api.getCustomerFirebaseAuth();
    api.getCustomerFirebaseFunctions();
    api.getFirebaseAuth();
    api.getFirebaseFunctions();
    expect(mocks.initializeAppCheck).toHaveBeenCalledTimes(2);
    expect(mocks.initializeAppCheck.mock.calls.map(([app]) => app.name)).toEqual([
      "haircut-customer-web",
      "[DEFAULT]",
    ]);
    for (const [, options] of mocks.initializeAppCheck.mock.calls) {
      expect(options.isTokenAutoRefreshEnabled).toBe(true);
      expect(options.provider.siteKey).toBe("public-fixture-site-key");
    }
    for (let index = 0; index < 2; index++) {
      expect(mocks.initializeAppCheck.mock.invocationCallOrder[index]).toBeLessThan(
        mocks.getAuth.mock.invocationCallOrder[index],
      );
      expect(mocks.initializeAppCheck.mock.invocationCallOrder[index]).toBeLessThan(
        mocks.getFunctions.mock.invocationCallOrder[index],
      );
    }
  });

  it("does not initialize without a configured site key", async () => {
    vi.stubEnv("VITE_FIREBASE_APP_CHECK_SITE_KEY", "");
    const api = await import("./firebase");
    api.getCustomerFirebaseAuth();
    api.getFirebaseAuth();
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
    expect(mocks.getAuth).toHaveBeenCalledTimes(2);
  });

  it("does not duplicate an already registered app provider", async () => {
    vi.stubGlobal("__haircutAppCheckApps", new Set(["haircut-customer-web", "[DEFAULT]"]));
    const api = await import("./firebase");
    api.getCustomerFirebaseFunctions();
    api.getFirebaseFunctions();
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });
});
