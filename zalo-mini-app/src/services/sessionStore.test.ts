import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSavedSession,
  loadSavedSessionCandidate,
  saveSession,
  SESSION_CACHE_TTL_MS,
} from "./sessionStore";
import type { AppSession, QrContext } from "./types";

const qr: QrContext = {
  qrType: "branch",
  salonId: "salon-a",
  branchId: "branch-a",
  mirrorId: "",
  qrToken: "token-a",
};
const session: AppSession = {
  qr,
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  sessionStatus: "waiting",
  customer: {
    customerId: "customer-a",
    name: "Anh Tan",
    phoneLast4: "1234",
    points: 3,
    allowPhoto: false,
  },
};

describe("sessionStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("chi luu ung vien toi thieu co hash danh tinh va khong luu du lieu rieng", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T10:00:00Z"));
    await saveSession(session);

    const candidate = loadSavedSessionCandidate({ ...qr, branchId: "branch-b" });
    const raw = localStorage.getItem("haircut_customer_session_v2") || "";

    expect(candidate).toMatchObject({
      schemaVersion: 2,
      salonId: "salon-a",
      sessionId: "session-a",
      customerId: "customer-a",
      savedAt: Date.now(),
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    });
    expect(candidate?.identityBinding).toMatch(/^[a-f0-9]{64}$/);
    expect(raw).not.toContain("token-a");
    expect(raw).not.toContain("Anh Tan");
    expect(raw).not.toContain("1234");
    expect(raw).not.toContain('"points"');
    expect(raw).not.toContain("zalo-a");
    expect(loadSavedSessionCandidate({ ...qr, salonId: "salon-b" })).toBeNull();
  });

  it("xoa cache cu chua toan bo AppSession", () => {
    localStorage.setItem("haircut_app_session_v1", JSON.stringify(session));

    expect(loadSavedSessionCandidate(qr)).toBeNull();
    expect(localStorage.getItem("haircut_app_session_v1")).toBeNull();
  });

  it("xoa candidate het TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T10:00:00Z"));
    await saveSession(session);
    vi.setSystemTime(new Date(Date.now() + SESSION_CACHE_TTL_MS + 1));

    expect(loadSavedSessionCandidate(qr)).toBeNull();
    expect(localStorage.getItem("haircut_customer_session_v2")).toBeNull();
  });

  it("xoa JSON hong thay vi nem loi", () => {
    localStorage.setItem("haircut_customer_session_v2", "{hong-json");

    expect(loadSavedSessionCandidate(qr)).toBeNull();
    expect(localStorage.getItem("haircut_customer_session_v2")).toBeNull();
  });

  it.each(["completed", "cancelled"] as const)(
    "khong luu session terminal %s",
    async (sessionStatus) => {
      await saveSession(session);
      await saveSession({ ...session, sessionStatus });

      expect(loadSavedSessionCandidate(qr)).toBeNull();
    },
  );

  it("xoa session da luu", async () => {
    await saveSession(session);
    clearSavedSession();
    expect(loadSavedSessionCandidate(qr)).toBeNull();
  });
});
