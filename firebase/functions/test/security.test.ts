import { describe, expect, it } from "vitest";
import {
  canUserAccessBranch,
  createSignedQrToken,
  isValidMirrorQr,
  isValidSignedQrToken,
  planDefaultBranchMigration,
  selectQrBranch,
  shouldReuseActiveSession,
} from "../src/security";

const secret = "0123456789abcdef0123456789abcdef";

describe("isValidMirrorQr", () => {
  const mirror = {
    salonId: "salon-a",
    qrToken: "token-an-toan",
    isActive: true,
  };

  it("chấp nhận QR đúng salon, token và đang bật", () => {
    expect(isValidMirrorQr(mirror, "salon-a", "token-an-toan")).toBe(true);
  });

  it("từ chối token sai, salon sai hoặc gương đã tắt", () => {
    expect(isValidMirrorQr(mirror, "salon-a", "token-gia")).toBe(false);
    expect(isValidMirrorQr(mirror, "salon-b", "token-an-toan")).toBe(false);
    expect(isValidMirrorQr({ ...mirror, isActive: false }, "salon-a", "token-an-toan")).toBe(false);
  });
});

describe("QR salon và chi nhánh", () => {
  const branches = [
    { id: "branch-a", isActive: true },
    { id: "branch-b", isActive: true },
  ];

  it("xử lý salon không có, có một và có nhiều chi nhánh hoạt động", () => {
    expect(selectQrBranch([], undefined)).toEqual({ mode: "none", branchId: null });
    expect(selectQrBranch([branches[0]], undefined)).toEqual({
      mode: "selected",
      branchId: "branch-a",
    });
    expect(selectQrBranch(branches, undefined)).toEqual({ mode: "choose", branchId: null });
  });

  it("chấp nhận QR salon hợp lệ", () => {
    const input = { kind: "salon" as const, salonId: "salon-a", version: 1 };
    const token = createSignedQrToken(secret, input);
    expect(isValidSignedQrToken(secret, input, token)).toBe(true);
  });

  it("chấp nhận QR chi nhánh hợp lệ", () => {
    const input = {
      kind: "branch" as const,
      salonId: "salon-a",
      branchId: "branch-a",
      version: 1,
    };
    const token = createSignedQrToken(secret, input);
    expect(isValidSignedQrToken(secret, input, token)).toBe(true);
  });

  it("từ chối token sai hoặc token của phiên bản đã bị xoay", () => {
    const input = { kind: "salon" as const, salonId: "salon-a", version: 2 };
    const oldToken = createSignedQrToken(secret, { ...input, version: 1 });
    expect(isValidSignedQrToken(secret, input, "token-sai")).toBe(false);
    expect(isValidSignedQrToken(secret, input, oldToken)).toBe(false);
  });

  it("xoay QR salon và QR chi nhánh không làm hết hạn lẫn nhau", () => {
    const salonInput = { kind: "salon" as const, salonId: "salon-a", version: 1 };
    const branchInput = {
      kind: "branch" as const,
      salonId: "salon-a",
      branchId: "branch-a",
      version: 1,
    };
    const salonToken = createSignedQrToken(secret, salonInput);
    const branchToken = createSignedQrToken(secret, branchInput);

    expect(isValidSignedQrToken(secret, salonInput, salonToken)).toBe(true);
    expect(isValidSignedQrToken(secret, { ...branchInput, version: 2 }, branchToken)).toBe(false);
    expect(isValidSignedQrToken(secret, salonInput, salonToken)).toBe(true);
    expect(isValidSignedQrToken(secret, { ...salonInput, version: 2 }, salonToken)).toBe(false);
    expect(isValidSignedQrToken(secret, branchInput, branchToken)).toBe(true);
  });

  it("từ chối chi nhánh bị khóa", () => {
    expect(selectQrBranch([{ id: "branch-a", isActive: false }], "branch-a")).toEqual({
      mode: "invalid",
      branchId: null,
    });
  });
});

describe("phân quyền và migration chi nhánh", () => {
  it("từ chối staff truy cập sai chi nhánh", () => {
    const staff = { role: "staff", branchIds: ["branch-a"] };
    expect(canUserAccessBranch(staff, "branch-a")).toBe(true);
    expect(canUserAccessBranch(staff, "branch-b")).toBe(false);
  });

  it("dùng lại phiên hiện tại khi khách quét QR lần nữa", () => {
    expect(
      shouldReuseActiveSession({
        status: "waiting",
        sessionId: "session-a",
        createdAtMs: 1_000,
        nowMs: 2_000,
        maxAgeMs: 10_000,
      }),
    ).toBe(true);
    expect(
      shouldReuseActiveSession({
        status: "waiting",
        sessionId: "session-a",
        createdAtMs: 1_000,
        expiresAtMs: 1_500,
        nowMs: 2_000,
        maxAgeMs: 10_000,
      }),
    ).toBe(false);
  });

  it("chạy migration hai lần không tạo trùng chi nhánh mặc định", () => {
    const first = planDefaultBranchMigration("salon-a", []);
    const second = planDefaultBranchMigration("salon-a", [first.branchId]);
    expect(first.shouldCreate).toBe(true);
    expect(second).toEqual({ branchId: first.branchId, shouldCreate: false });
  });
});
