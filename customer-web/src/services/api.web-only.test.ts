import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHaircutHistory, getRewards, getCustomerWheelConfig, spinWheel } from "./api";
import type { AppSession } from "./types";

const web = vi.hoisted(() => ({
  getWebCustomerHistory: vi.fn().mockResolvedValue([]),
  getWebCustomerRewards: vi.fn().mockResolvedValue([]),
  getWebCustomerSessionState: vi.fn().mockResolvedValue({}),
  spinWebCustomerWheel: vi.fn().mockResolvedValue({}),
}));
vi.mock("./webCustomerApi", () => web);
vi.mock("./firebase", () => ({
  isFirebaseConfigured: () => false,
  getFunctionWriteMode: () => "required",
  getFirebaseDb: () => null,
  callFunction: vi.fn(),
}));
vi.mock("./zalo", () => ({ getZaloAccessToken: vi.fn(), getZaloIdentity: vi.fn() }));

describe("Web customer identity boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  const legacy = {
    qr: { salonId: "salon-test", qrType: "branch", branchId: "branch-test", mirrorId: "" },
    sessionId: "legacy-session", zaloUserId: "legacy-user", sessionStatus: "completed",
    customer: { customerId: "legacy-customer", name: "Legacy", phoneLast4: "0000", points: 10, allowPhoto: false },
  } as AppSession;
  it.each([
    ["history", () => getHaircutHistory(legacy)],
    ["rewards", () => getRewards(legacy)],
    ["wheel config", () => getCustomerWheelConfig(legacy)],
    ["spin", () => spinWheel(legacy, 1)],
  ])("rejects cached legacy identity before %s", async (_, call) => {
    await expect(call()).rejects.toThrow(/đăng nhập/i);
    for (const fn of Object.values(web)) expect(fn).not.toHaveBeenCalled();
  });
});
