import { describe, expect, it } from "vitest";
import { adminErrorMessage, makeRepairInput, supportLinks } from "./adminSupport";
import type { AdminDiagnostics } from "./adminApi";

describe("safe support messages and links", () => {
  it.each([
    ["RECENT_LOGIN_REQUIRED", "đăng xuất"],
    ["ADMIN_PREVIEW_STALE", "Dữ liệu vừa thay đổi"],
    ["ADMIN_SUPPORT_REPAIRS_DISABLED", "chưa bật"],
  ])("explains %s without printing server details", (errorCode, message) => {
    expect(adminErrorMessage({ details: { errorCode }, message: "PRIVATE_SECRET" })).toContain(
      message,
    );
  });
  it.each([
    ["permission-denied", "quyền"],
    ["unauthenticated", "quyền"],
    ["resource-exhausted", "một phút"],
    ["already-exists", "đã được xử lý"],
    ["not-found", "chưa có"],
    ["failed-precondition", "Điều kiện"],
    ["invalid-argument", "Điều kiện"],
  ])("classifies %s", (code, message) =>
    expect(adminErrorMessage({ code: `functions/${code}` })).toContain(message),
  );
  it.each([undefined, null, {}, new Error("PRIVATE_SECRET access_token=fixture"), "unexpected"])(
    "does not expose arbitrary errors %#",
    (error) => {
      expect(adminErrorMessage(error)).toMatch(/Chưa kết nối được/);
      expect(adminErrorMessage(error)).not.toContain("PRIVATE_SECRET");
    },
  );
  it("uses only fixed Google destinations and rejects a forged project id", () => {
    expect(supportLinks("fixture-project")).toHaveLength(3);
    for (const link of supportLinks("fixture-project"))
      expect(new URL(link.href).hostname).toMatch(
        /^console\.(cloud\.google|firebase\.google)\.com$/,
      );
    expect(supportLinks("x&redirect=https://evil.test")).toEqual([]);
    expect(supportLinks("")).toEqual([]);
  });
});

describe("repair input uses the inspected snapshot", () => {
  const diagnostic = {
    salonId: "salon-a",
    customerCount: { stored: 9, actual: 2 },
  } as AdminDiagnostics;
  it("does not accept a manually selected point balance", () => {
    expect(
      makeRepairInput(
        diagnostic,
        "reconcile_customer_count",
        "  Valid reason ",
        " Salon A ",
        "operation-123456789",
      ),
    ).toEqual({
      salonId: "salon-a",
      action: "reconcile_customer_count",
      reason: "Valid reason",
      confirmedSalonName: "Salon A",
      operationId: "operation-123456789",
      expectedStoredCount: 9,
      expectedActualCount: 2,
    });
  });
  it("requires the selected stale pointer and carries its expected session id", () => {
    expect(() =>
      makeRepairInput(
        diagnostic,
        "clear_stale_session_pointer",
        "Valid reason",
        "Salon A",
        "operation-123456789",
      ),
    ).toThrow(/Thiếu liên kết/);
    expect(
      makeRepairInput(
        diagnostic,
        "clear_stale_session_pointer",
        "Valid reason",
        "Salon A",
        "operation-123456789",
        { pointerId: "pointer-a", sessionId: "session-a", customerId: "customer-a" },
      ),
    ).toMatchObject({ pointerId: "pointer-a", expectedSessionId: "session-a" });
  });
});
