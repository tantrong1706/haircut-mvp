import { describe, expect, it } from "vitest";
import type { AdminDiagnostics } from "./adminApi";
import {
  auditActionLabel,
  diagnosticSummary,
  formatDiagnosticReport,
  issueGuidance,
} from "./adminPresentation";

const clean = {
  salonId: "salon-fixture",
  salonName: "PRIVATE_SALON_NAME",
  checkedAtMs: 1,
  customerCount: { stored: 2, actual: 2 },
  activeBranches: 1,
  issues: [],
  stalePointers: [],
  pointerScan: { checked: 5, hasMore: false },
} as unknown as AdminDiagnostics;

describe("diagnostic presentation does not imply a wider check than performed", () => {
  it("describes a clean result only within the checked scope", () => {
    expect(diagnosticSummary(clean)).toMatchObject({
      tone: "success",
      title: "Chưa thấy bất thường",
    });
  });
  it("marks a partial scan as incomplete, never clean", () => {
    expect(
      diagnosticSummary({ ...clean, pointerScan: { checked: 50, hasMore: true } }),
    ).toMatchObject({ tone: "warning", title: "Kiểm tra chưa đầy đủ" });
  });
  it("marks either a warning or a stale pointer as needing comparison", () => {
    expect(
      diagnosticSummary({
        ...clean,
        issues: [
          {
            code: "CUSTOMER_COUNT_MISMATCH",
            severity: "warning",
            message: "Counter",
            action: "reconcile_customer_count",
          },
        ],
      }),
    ).toMatchObject({ tone: "warning", title: "Có dữ liệu cần đối chiếu" });
    expect(
      diagnosticSummary({
        ...clean,
        stalePointers: [{ pointerId: "p", sessionId: "s", customerId: "c" }],
      }).tone,
    ).toBe("warning");
  });
  it("prioritizes an error even when the scan is partial", () => {
    expect(
      diagnosticSummary({
        ...clean,
        pointerScan: { checked: 50, hasMore: true },
        issues: [{ code: "OWNER_UNAVAILABLE", severity: "error", message: "Owner", action: null }],
      }),
    ).toMatchObject({ tone: "error", title: "Cần xử lý quyền hoặc cấu hình" });
  });
});

describe("operator guidance", () => {
  it.each([
    "CUSTOMER_COUNT_MISMATCH",
    "OWNER_UNAVAILABLE",
    "NO_ACTIVE_BRANCH",
    "SALON_INACTIVE",
    "MAINTENANCE_MODE",
    "INVALID_SESSION_POINTER",
    "STALE_SESSION_POINTER",
    "FEATURE_DISABLED_checkinEnabled",
    "FEATURE_DISABLED_photoUploadEnabled",
  ])("provides bounded guidance for %s", (code) => {
    expect(issueGuidance(code).nextStep.length).toBeGreaterThan(20);
    expect(issueGuidance(code).title.length).toBeGreaterThan(5);
  });
  it("does not expose an unknown code as advice or invent a repair", () => {
    const guidance = issueGuidance("PRIVATE_TOKEN=untrusted");
    expect(guidance.title).toBe("Cần kiểm tra chuyên sâu");
    expect(guidance.nextStep).not.toContain("PRIVATE_TOKEN");
  });
  it("translates the two supported audit actions and keeps unknown actions neutral", () => {
    expect(auditActionLabel("admin.support.reconcile_customer_count")).toBe("Đồng bộ bộ đếm khách");
    expect(auditActionLabel("admin.support.clear_stale_session_pointer")).toBe(
      "Gỡ liên kết lượt cũ",
    );
    expect(auditActionLabel("PRIVATE_UNKNOWN_ACTION")).toBe("Thao tác quản trị");
  });
});

describe("copyable diagnostic summary", () => {
  it("only exports bounded operational facts, not messages, names or customer/session identifiers", () => {
    const report = formatDiagnosticReport({
      ...clean,
      issues: [
        {
          code: "CUSTOMER_COUNT_MISMATCH",
          severity: "warning",
          message: "PRIVATE_MESSAGE access_token=fixture",
          action: "reconcile_customer_count",
        },
        { code: "PRIVATE_CODE", severity: "error", message: "PRIVATE", action: null },
      ],
      stalePointers: [
        {
          pointerId: "PRIVATE_POINTER",
          sessionId: "PRIVATE_SESSION",
          customerId: "PRIVATE_CUSTOMER",
        },
      ],
    });
    expect(report).toContain("salon-fixture");
    expect(report).toContain("CUSTOMER_COUNT_MISMATCH");
    expect(report).toContain("UNCLASSIFIED_ISSUE");
    expect(report).not.toContain("PRIVATE");
    expect(report).not.toContain("access_token");
  });
  it("does not throw or stringify invalid identifiers, dates or counts", () => {
    const report = formatDiagnosticReport({
      ...clean,
      salonId: "PRIVATE invalid/id",
      checkedAtMs: NaN,
      customerCount: { stored: null, actual: NaN },
      activeBranches: -1,
    });
    expect(report).toContain("Không xác định");
    expect(report).not.toContain("PRIVATE");
    expect(report).not.toContain("NaN");
  });
});
