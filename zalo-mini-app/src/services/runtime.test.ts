import { afterEach, describe, expect, it } from "vitest";
import { isZaloMiniAppRuntime } from "./runtime";

type RuntimeWindow = Window & { ZJSBridge?: unknown };

afterEach(() => {
  delete (window as RuntimeWindow).ZJSBridge;
});

describe("isZaloMiniAppRuntime", () => {
  it("không nhận trình duyệt web thường là Zalo", () => {
    expect(isZaloMiniAppRuntime()).toBe(false);
  });

  it("nhận môi trường có Zalo bridge", () => {
    (window as RuntimeWindow).ZJSBridge = {};
    expect(isZaloMiniAppRuntime()).toBe(true);
  });
});
