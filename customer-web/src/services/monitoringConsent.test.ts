import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAnalytics: vi.fn(() => ({ app: "fixture" })),
  logEvent: vi.fn(),
  collection: vi.fn(),
  isSupported: vi.fn(async () => true),
  getPerformance: vi.fn(() => ({ dataCollectionEnabled: true, instrumentationEnabled: true })),
}));
vi.mock("./firebase", () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: () => ({ name: "fixture" }),
  getFunctionWriteMode: () => "required",
}));
vi.mock("./qr", () => ({ parseQrContext: () => ({}) }));
vi.mock("firebase/analytics", () => ({
  getAnalytics: mocks.getAnalytics,
  isSupported: mocks.isSupported,
  logEvent: mocks.logEvent,
  setAnalyticsCollectionEnabled: mocks.collection,
  setUserId: vi.fn(),
  setUserProperties: vi.fn(),
}));
vi.mock("firebase/performance", () => ({ getPerformance: mocks.getPerformance, trace: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.isSupported.mockResolvedValue(true);
  localStorage.clear();
  vi.stubEnv("VITE_MONITORING_DISABLED", "false");
  vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-FIXTURE");
  vi.stubEnv("VITE_SENTRY_DSN", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("monitoring requires an explicit optional-data choice", () => {
  it("can re-enable the existing Performance singleton after a new explicit choice", async () => {
    const performance = { dataCollectionEnabled: true, instrumentationEnabled: true };
    mocks.getPerformance.mockReturnValue(performance);
    const privacy = await import("./privacyPreferences");
    const monitoring = await import("./monitoring");
    privacy.savePrivacyPreferences(true);
    monitoring.applyMonitoringPrivacyPreference();
    await vi.dynamicImportSettled();
    privacy.savePrivacyPreferences(false);
    monitoring.applyMonitoringPrivacyPreference();
    await vi.dynamicImportSettled();
    expect(performance.dataCollectionEnabled).toBe(false);
    privacy.savePrivacyPreferences(true);
    monitoring.applyMonitoringPrivacyPreference();
    await vi.dynamicImportSettled();
    expect(performance.dataCollectionEnabled).toBe(true);
    expect(performance.instrumentationEnabled).toBe(true);
  });
  it("starts only after opting in and stops future events immediately on withdrawal", async () => {
    const privacy = await import("./privacyPreferences");
    const monitoring = await import("./monitoring");
    privacy.savePrivacyPreferences(true);
    monitoring.applyMonitoringPrivacyPreference();
    await vi.dynamicImportSettled();
    expect(mocks.getAnalytics).toHaveBeenCalledTimes(1);
    expect(mocks.getPerformance).toHaveBeenCalledTimes(1);
    mocks.logEvent.mockClear();
    monitoring.trackEvent("queued_before_withdrawal");
    privacy.savePrivacyPreferences(false);
    monitoring.applyMonitoringPrivacyPreference();
    monitoring.trackEvent("after_withdrawal");
    await vi.dynamicImportSettled();
    expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), false);
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });

  it("does not initialize Analytics or Performance before any choice", async () => {
    const monitoring = await import("./monitoring");
    monitoring.initMonitoring();
    await vi.dynamicImportSettled();
    expect(mocks.getAnalytics).not.toHaveBeenCalled();
    expect(mocks.getPerformance).not.toHaveBeenCalled();
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });

  it("does not send events or attach a user merely because Firebase is configured", async () => {
    const monitoring = await import("./monitoring");
    monitoring.trackEvent("page_view", { page_path: "/privacy" });
    monitoring.setMonitoringUser({ uid: "fixture-user", role: "owner", salonId: "fixture-salon" });
    await vi.dynamicImportSettled();
    expect(mocks.getAnalytics).not.toHaveBeenCalled();
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });
});
