import { afterEach, describe, expect, it, vi } from "vitest";
import { isZaloMiniAppRuntime } from "./runtime";

type RuntimeWindow = Window & { ZJSBridge?: unknown };

afterEach(() => {
  delete (window as RuntimeWindow).ZJSBridge;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isZaloMiniAppRuntime", () => {
  it("production Web vẫn dùng Phone Auth khi mở trong trình duyệt Zalo", () => {
    vi.stubEnv("VITE_APP_ENV", "production");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 Zalo/24.0");
    expect(isZaloMiniAppRuntime()).toBe(false);
  });

  it("production Web không chuyển luồng theo bridge hoặc cờ preview legacy", () => {
    vi.stubEnv("VITE_APP_ENV", "production");
    vi.stubEnv("VITE_ZALO_PREVIEW", "true");
    (window as RuntimeWindow).ZJSBridge = {};
    expect(isZaloMiniAppRuntime()).toBe(false);
  });

  it("không nhận trình duyệt web thường là Zalo", () => {
    expect(isZaloMiniAppRuntime()).toBe(false);
  });

  it("nhận môi trường có Zalo bridge", () => {
    (window as RuntimeWindow).ZJSBridge = {};
    expect(isZaloMiniAppRuntime()).toBe(true);
  });

  it("chỉ nhận chế độ xem trước khi biến test được bật", () => {
    vi.stubEnv("VITE_ZALO_PREVIEW", "true");
    expect(isZaloMiniAppRuntime()).toBe(true);
  });
});
