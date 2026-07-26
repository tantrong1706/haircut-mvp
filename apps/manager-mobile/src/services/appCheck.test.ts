import { describe, expect, it, vi } from "vitest";
import {
  initializeManagerWebAppCheck,
  isFirebaseAppCheckInitialized,
  managerAppCheckErrorMessage,
  markFirebaseAppCheckInitialized,
} from "./appCheck";

describe("Manager Web App Check", () => {
  it("khởi tạo provider khi có site key hợp lệ", () => {
    const initialize = vi.fn();
    const createProvider = vi.fn((siteKey: string) => ({ siteKey }));

    expect(
      initializeManagerWebAppCheck({
        app: { name: "manager" },
        siteKey: "enterprise-site-key",
        production: true,
        nativeRuntime: false,
        createProvider,
        initialize,
      }),
    ).toEqual({ enabled: true, debugMode: false });
    expect(createProvider).toHaveBeenCalledWith("enterprise-site-key");
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("báo rõ cấu hình còn thiếu thay vì gọi SDK", () => {
    const initialize = vi.fn();
    expect(
      initializeManagerWebAppCheck({
        app: {},
        siteKey: "",
        production: true,
        nativeRuntime: false,
        createProvider: () => ({}),
        initialize,
      }),
    ).toEqual({ enabled: false, reason: "missing_site_key" });
    expect(initialize).not.toHaveBeenCalled();
  });

  it("chỉ kích hoạt debug token trong development", () => {
    const productionGlobal = {} as typeof globalThis & {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    };
    initializeManagerWebAppCheck({
      app: {},
      siteKey: "site-key",
      debugToken: "debug-secret",
      production: true,
      nativeRuntime: false,
      createProvider: () => ({}),
      initialize: () => undefined,
      debugGlobal: productionGlobal,
    });
    expect(productionGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();

    const developmentGlobal = {} as typeof productionGlobal;
    initializeManagerWebAppCheck({
      app: {},
      siteKey: "site-key",
      debugToken: "true",
      production: false,
      nativeRuntime: false,
      createProvider: () => ({}),
      initialize: () => undefined,
      debugGlobal: developmentGlobal,
    });
    expect(developmentGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });

  it("không khởi tạo web provider trong native runtime", () => {
    const initialize = vi.fn();
    expect(
      initializeManagerWebAppCheck({
        app: {},
        siteKey: "site-key",
        production: true,
        nativeRuntime: true,
        createProvider: () => ({}),
        initialize,
      }),
    ).toEqual({ enabled: false, reason: "native_runtime" });
    expect(initialize).not.toHaveBeenCalled();
  });

  it("không làm crash giao diện khi SDK lỗi", () => {
    expect(
      initializeManagerWebAppCheck({
        app: {},
        siteKey: "site-key",
        production: true,
        nativeRuntime: false,
        createProvider: () => ({}),
        initialize: () => {
          throw new Error("sdk failed");
        },
      }),
    ).toEqual({ enabled: false, reason: "initialization_failed" });
  });

  it("ghi nhận app đã khởi tạo để service dùng chung không tạo lần hai", () => {
    markFirebaseAppCheckInitialized("manager-test-app");
    expect(isFirebaseAppCheckInitialized("manager-test-app")).toBe(true);
  });

  it("đổi lỗi callable App Check thành thông báo an toàn", () => {
    expect(managerAppCheckErrorMessage({ code: "app-check/invalid-token" })).toContain(
      "kiểm tra bảo mật",
    );
    expect(managerAppCheckErrorMessage(new Error("network failed"))).toBe("");
  });
});
