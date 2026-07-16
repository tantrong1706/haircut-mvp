import { describe, expect, it, vi } from "vitest";
import { adminAppCheckErrorMessage, initializeAdminAppCheck } from "./appCheck";

describe("Admin App Check", () => {
  it("khởi tạo provider khi có site key hợp lệ", () => {
    const initialize = vi.fn();
    const createProvider = vi.fn((siteKey: string) => ({ siteKey }));

    expect(
      initializeAdminAppCheck({
        app: { name: "admin" },
        siteKey: "enterprise-site-key",
        production: true,
        createProvider,
        initialize,
      }),
    ).toEqual({ enabled: true, debugMode: false });
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("không làm crash giao diện khi SDK App Check lỗi", () => {
    expect(
      initializeAdminAppCheck({
        app: {},
        siteKey: "site-key",
        production: true,
        createProvider: () => ({}),
        initialize: () => {
          throw new Error("sdk failed");
        },
      }),
    ).toEqual({ enabled: false, reason: "initialization_failed" });
  });

  it("chỉ bật debug token ở local development", () => {
    const productionGlobal = {} as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    };
    initializeAdminAppCheck({
      app: {},
      siteKey: "site-key",
      debugToken: "debug-secret",
      production: true,
      createProvider: () => ({}),
      initialize: () => undefined,
      debugGlobal: productionGlobal,
    });
    expect(productionGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();

    const localGlobal = {} as typeof productionGlobal;
    initializeAdminAppCheck({
      app: {},
      siteKey: "site-key",
      debugToken: "true",
      production: false,
      createProvider: () => ({}),
      initialize: () => undefined,
      debugGlobal: localGlobal,
    });
    expect(localGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });

  it("đổi lỗi App Check thành thông báo vận hành an toàn", () => {
    expect(adminAppCheckErrorMessage({ code: "app-check/invalid-token" })).toContain(
      "kiểm tra bảo mật",
    );
    expect(adminAppCheckErrorMessage(new Error("network failed"))).toBe("");
  });
});
