import { describe, expect, it } from "vitest";
import {
  buildCustomerContactPatch,
  canCreateCustomerWithinPlan,
  canRestoreReward,
  canCancelServiceSession,
  countUniqueCustomersSince,
  deletionJobOutcome,
  effectiveRewardStatus,
  isVerifiedOwnerIdentity,
  isServiceSessionExpired,
  legacyBranchPatch,
  activeWheelSlotCount,
  rewardExpiresAtMs,
  selectWheelSlot,
  selectWheelSlotByIndex,
  serviceSessionExpiresAtMs,
  wheelRewardOutcome,
} from "../src/businessRules";

describe("danh tính owner", () => {
  it("chỉ cho tạo salon khi email đã xác minh", () => {
    expect(isVerifiedOwnerIdentity({ email: "owner@example.com", emailVerified: true })).toBe(true);
    expect(isVerifiedOwnerIdentity({ email: "owner@example.com", emailVerified: false })).toBe(
      false,
    );
    expect(isVerifiedOwnerIdentity({ emailVerified: true })).toBe(false);
  });
});

describe("dữ liệu khách khi check-in lại", () => {
  it("giữ phone và birthday cũ khi input trống", () => {
    expect(buildCustomerContactPatch({ phone: "", birthday: "" })).toEqual({});
  });

  it("chỉ xóa khi có cờ xóa rõ ràng", () => {
    expect(buildCustomerContactPatch({ clearPhone: true, clearBirthday: true })).toEqual({
      phone: null,
      phoneLast4: null,
      birthday: null,
    });
  });
});

describe("hạn mức khách theo gói", () => {
  it("cho khách thứ 50 và chặn khách thứ 51 ở gói free", () => {
    expect(
      canCreateCustomerWithinPlan({ plan: "free", customerCount: 49, freeCustomerLimit: 50 }),
    ).toBe(true);
    expect(
      canCreateCustomerWithinPlan({ plan: "free", customerCount: 50, freeCustomerLimit: 50 }),
    ).toBe(false);
    expect(
      canCreateCustomerWithinPlan({ plan: "pro", customerCount: 51, freeCustomerLimit: 50 }),
    ).toBe(true);
  });
});

describe("vòng đời lượt cắt", () => {
  it("nhận biết phiên hết hạn", () => {
    const expiresAtMs = serviceSessionExpiresAtMs(1_000, 12_000);
    expect(isServiceSessionExpired(expiresAtMs, 12_999)).toBe(false);
    expect(isServiceSessionExpired(expiresAtMs, 13_000)).toBe(true);
  });

  it("staff chỉ hủy lượt chờ trong chi nhánh hoặc lượt mình đang phục vụ", () => {
    const base = {
      userId: "staff-a",
      role: "staff" as const,
      assignedBranchIds: ["branch-a"],
      branchId: "branch-a",
    };
    expect(canCancelServiceSession({ ...base, status: "waiting" })).toBe(true);
    expect(
      canCancelServiceSession({ ...base, status: "serving", assignedStaffId: "staff-a" }),
    ).toBe(true);
    expect(
      canCancelServiceSession({ ...base, status: "serving", assignedStaffId: "staff-b" }),
    ).toBe(false);
    expect(canCancelServiceSession({ ...base, branchId: "branch-b", status: "waiting" })).toBe(
      false,
    );
  });
});

describe("thống kê và vòng quay", () => {
  it("chọn đúng ô theo chỉ số nguyên đã sinh an toàn", () => {
    const slots = [
      { label: "Đã tắt", active: false, type: "reward" },
      { label: "Quà A", active: true, type: "reward" },
      { label: "Quà B", active: true, type: "reward" },
    ];

    expect(activeWheelSlotCount(slots)).toBe(2);
    expect(selectWheelSlotByIndex(slots, 1)).toMatchObject({ index: 1, label: "Quà B" });
    expect(selectWheelSlotByIndex(slots, 2)).toBeNull();
  });

  it("đếm khách hoàn tất duy nhất", () => {
    expect(
      countUniqueCustomersSince(
        [
          { customerId: "customer-a", createdAtMs: 2_000 },
          { customerId: "customer-a", createdAtMs: 3_000 },
          { customerId: "customer-b", createdAtMs: 3_000 },
          { customerId: "customer-c", createdAtMs: 500 },
        ],
        1_000,
      ),
    ).toBe(2);
  });

  it("ô no_prize giữ đúng index nhưng không phải quà", () => {
    expect(
      selectWheelSlot(
        [
          { label: "Giảm 10%", active: true, type: "reward" },
          { label: "Chúc bạn may mắn", active: true, type: "no_prize" },
        ],
        0.75,
      ),
    ).toMatchObject({ index: 1, type: "no_prize" });
  });

  it("selectedIndex khớp danh sách ô thực sự hiển thị", () => {
    expect(
      selectWheelSlot(
        [
          { label: "Đã tắt", active: false, type: "reward" },
          { label: "Quà đang bật", active: true, type: "reward" },
        ],
        0.5,
      ),
    ).toMatchObject({ index: 0, label: "Quà đang bật" });
  });

  it("ô no_prize không sinh mã quà chưa dùng", () => {
    expect(wheelRewardOutcome("no_prize", "CODE-KHONG-DUOC-DUNG")).toEqual({
      isWinning: false,
      rewardCode: null,
      status: "no_prize",
    });
  });
});

describe("hạn dùng mã quà", () => {
  it("hết hạn đúng tại mốc thời gian cấu hình", () => {
    const expiresAtMs = rewardExpiresAtMs(1_000, 90);

    expect(effectiveRewardStatus("unused", expiresAtMs, expiresAtMs - 1)).toBe("unused");
    expect(effectiveRewardStatus("unused", expiresAtMs, expiresAtMs)).toBe("expired");
    expect(effectiveRewardStatus("used", expiresAtMs, expiresAtMs + 1)).toBe("used");
    expect(effectiveRewardStatus("revoked", expiresAtMs, expiresAtMs - 1)).toBe("revoked");
  });

  it("chỉ cho owner hoàn tác mã vừa đổi trong cửa sổ an toàn", () => {
    const nowMs = 1_000_000;
    expect(
      canRestoreReward({
        status: "used",
        usedAtMs: nowMs - 5 * 60_000,
        expiresAtMs: nowMs + 60_000,
        nowMs,
        restoreWindowMs: 15 * 60_000,
      }),
    ).toBe(true);
    expect(
      canRestoreReward({
        status: "used",
        usedAtMs: nowMs - 16 * 60_000,
        expiresAtMs: nowMs + 60_000,
        nowMs,
        restoreWindowMs: 15 * 60_000,
      }),
    ).toBe(false);
  });
});

describe("xóa dữ liệu", () => {
  it("chỉ hoàn tất khi không còn residue", () => {
    expect(
      deletionJobOutcome({
        remainingDocuments: 0,
        remainingStorageFiles: 0,
        failedStorageFiles: 0,
        operationFailed: false,
      }),
    ).toBe("completed");
    expect(
      deletionJobOutcome({
        remainingDocuments: 1,
        remainingStorageFiles: 0,
        failedStorageFiles: 0,
        operationFailed: false,
      }),
    ).toBe("partial");
  });
});

describe("migration chi nhánh", () => {
  it("gán dữ liệu cũ vào chi nhánh mặc định và chạy lại không đổi", () => {
    const firstPatch = legacyBranchPatch({
      currentBranchId: null,
      defaultBranchId: "branch-main",
      defaultBranchName: "Chi nhánh chính",
    });

    expect(firstPatch).toEqual({
      branchId: "branch-main",
      branchName: "Chi nhánh chính",
      branchAddress: "",
    });
    expect(
      legacyBranchPatch({
        currentBranchId: firstPatch?.branchId,
        defaultBranchId: "branch-main",
        defaultBranchName: "Chi nhánh chính",
      }),
    ).toBeNull();
  });
});
