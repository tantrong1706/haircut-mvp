import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectCameraPermission } from "./cameraPermission";

describe("camera permission classification", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLInputElement.prototype, "capture", {
      configurable: true,
      writable: true,
      value: "",
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn() },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["granted", "prompt", "denied"] as const)("phân loại trạng thái %s", async (state) => {
    vi.spyOn(navigator.permissions, "query").mockResolvedValue({ state } as PermissionStatus);
    await expect(inspectCameraPermission()).resolves.toBe(state);
  });

  it("trả unsupported khi WebView không cho truy vấn quyền camera", async () => {
    vi.spyOn(navigator.permissions, "query").mockRejectedValue(new Error("not supported"));
    await expect(inspectCameraPermission()).resolves.toBe("unsupported");
  });
});
