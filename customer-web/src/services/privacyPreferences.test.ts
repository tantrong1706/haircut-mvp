import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIVACY_PREFERENCES_KEY,
  readPrivacyPreferences,
  savePrivacyPreferences,
} from "./privacyPreferences";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("optional monitoring preferences", () => {
  it("rejects expired, future-dated and incorrectly typed choices", () => {
    for (const value of [
      { version: "2026-10-29", optional: true, updatedAt: Date.now() - 181 * 86_400_000 },
      { version: "2026-10-29", optional: true, updatedAt: Date.now() + 60_000 },
      { version: "2026-10-29", optional: "true", updatedAt: Date.now() },
      { version: "2026-10-29", optional: true, updatedAt: -1 },
    ]) {
      localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify(value));
      expect(readPrivacyPreferences()).toBeNull();
    }
  });
  it("removes analytics cookies but preserves unrelated cookies and login storage", () => {
    document.cookie = "_ga=fixture; Path=/";
    document.cookie = "_ga_FIXTURE=fixture; Path=/";
    document.cookie = "auth_fixture=preserve; Path=/";
    localStorage.setItem("firebase:authUser:fixture", "preserve");
    savePrivacyPreferences(false);
    expect(document.cookie).not.toMatch(/_ga(?:=|_FIXTURE=)/u);
    expect(document.cookie).toContain("auth_fixture=preserve");
    expect(localStorage.getItem("firebase:authUser:fixture")).toBe("preserve");
  });
  it("still records denial and notifies listeners when cookies are blocked", () => {
    const listener = vi.fn();
    window.addEventListener("haircut:privacy-preferences", listener);
    try {
      vi.spyOn(document, "cookie", "get").mockImplementation(() => {
        throw new Error("cookies blocked");
      });
      expect(savePrivacyPreferences(false)).toBe(true);
      expect(readPrivacyPreferences()?.optional).toBe(false);
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("haircut:privacy-preferences", listener);
    }
  });
  it("defaults to no recorded choice and never interprets malformed data as consent", () => {
    expect(readPrivacyPreferences()).toBeNull();
    for (const raw of [
      "true",
      "not-json",
      '{"optional":true}',
      '{"version":"old","optional":true,"updatedAt":1}',
    ]) {
      localStorage.setItem(PRIVACY_PREFERENCES_KEY, raw);
      expect(readPrivacyPreferences()).toBeNull();
    }
  });
  it.each([true, false])(
    "records the explicit optional=%s choice without any customer identifier",
    (optional) => {
      expect(savePrivacyPreferences(optional)).toBe(true);
      const record = readPrivacyPreferences();
      expect(record?.optional).toBe(optional);
      expect(Object.keys(record || {}).sort()).toEqual(["optional", "updatedAt", "version"]);
      expect(Number.isFinite(record?.updatedAt)).toBe(true);
    },
  );
  it("fails closed if browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPrivacyPreferences()).toBeNull();
    expect(savePrivacyPreferences(true)).toBe(false);
  });
  it("fails closed when a new choice cannot replace an older opt-in", () => {
    expect(savePrivacyPreferences(true)).toBe(true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("write blocked");
    });
    expect(savePrivacyPreferences(true)).toBe(false);
    expect(readPrivacyPreferences()).toBeNull();
  });
});
