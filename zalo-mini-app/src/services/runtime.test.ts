import { afterEach, describe, expect, it, vi } from "vitest";
import { isZaloMiniAppRuntime } from "./runtime";

type RuntimeWindow = Window & { ZJSBridge?: unknown };

afterEach(() => {
  delete (window as RuntimeWindow).ZJSBridge;
  vi.unstubAllEnvs();
});

describe("isZaloMiniAppRuntime", () => {
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
