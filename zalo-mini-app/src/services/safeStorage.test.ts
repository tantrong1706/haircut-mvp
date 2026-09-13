import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";

describe("safeStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("doc va ghi du lieu khi localStorage kha dung", () => {
    expect(safeStorageSet("key", "value")).toBe(true);
    expect(safeStorageGet("key")).toBe("value");
    expect(safeStorageRemove("key")).toBe(true);
    expect(safeStorageGet("key")).toBeNull();
  });

  it("khong lam app loi khi getItem bi chan", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(safeStorageGet("key")).toBeNull();
  });

  it("khong lam app loi khi setItem vuot quota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(safeStorageSet("key", "value")).toBe(false);
  });

  it("khong lam app loi khi removeItem bi chan", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(safeStorageRemove("key")).toBe(false);
  });
});
