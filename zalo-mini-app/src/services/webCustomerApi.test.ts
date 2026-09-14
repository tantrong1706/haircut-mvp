import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession, QrContext } from "./types";

const mocks = vi.hoisted(() => ({
  callCustomerWebFunction: vi.fn(),
}));

vi.mock("./firebase", () => ({
  callCustomerWebFunction: mocks.callCustomerWebFunction,
  isFirebaseConfigured: () => true,
}));

import {
  checkInWebCustomer,
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSessionState,
  resolveWebCustomerContext,
  spinWebCustomerWheel,
} from "./webCustomerApi";

const qr: QrContext = {
  qrType: "branch",
  salonId: "salon-a",
  branchId: "branch-a",
  mirrorId: "",
  qrToken: "signed-token",
};

const rawContext = {
  qr: {
    salonId: "salon-a",
    salonName: "Salon A",
    salonAvatarUrl: "",
    branchId: "branch-a",
    branchName: "Chi nhánh A",
    branchAddress: "1 Đường A",
  },
  customer: {
    customerId: "customer-a",
    name: "Khách hàng",
    phoneLast4: "4567",
    points: 3,
    allowPhoto: false,
  },
  activeSession: null,
};

const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-a",
  qr,
  sessionId: "session-a",
  branchName: "Chi nhánh A",
  branchAddress: "1 Đường A",
  zaloUserId: "",
  sessionStatus: "waiting",
  customer: rawContext.customer,
};

describe("web customer callable adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolve context chỉ gửi signed QR, không gửi UID từ client", async () => {
    mocks.callCustomerWebFunction.mockResolvedValue(rawContext);
    await expect(resolveWebCustomerContext(qr)).resolves.toEqual(rawContext);
    expect(mocks.callCustomerWebFunction).toHaveBeenCalledWith("getWebCustomerContext", qr);
    expect(mocks.callCustomerWebFunction.mock.calls[0][1]).not.toHaveProperty("uid");
  });

  it("check-in tạo AppSession Firebase và không cần Zalo token", async () => {
    mocks.callCustomerWebFunction.mockResolvedValue({
      sessionId: "session-a",
      branchId: "branch-a",
      branchName: "Chi nhánh A",
      branchAddress: "1 Đường A",
      sessionStatus: "waiting",
      customer: rawContext.customer,
    });
    const result = await checkInWebCustomer(qr);
    expect(result).toMatchObject({
      identityProvider: "firebase",
      zaloUserId: "",
      sessionId: "session-a",
      customer: { customerId: "customer-a" },
    });
    expect(mocks.callCustomerWebFunction).toHaveBeenCalledWith("checkInWebCustomer", qr);
  });

  it("session history rewards và spin đều dùng authenticated web callables", async () => {
    mocks.callCustomerWebFunction
      .mockResolvedValueOnce({
        sessionStatus: "waiting",
        branchId: "branch-a",
        branchName: "Chi nhánh A",
        branchAddress: "1 Đường A",
        customer: rawContext.customer,
        wheelConfig: { configVersion: 1, requiredPoints: 5, slots: [] },
      })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ rewards: [] })
      .mockResolvedValueOnce({
        rewardId: "reward-a",
        rewardName: "Quà A",
        rewardCode: "HC-TEST",
        pointsAfter: 0,
        isWinning: true,
        selectedIndex: 0,
        selectedSlotId: "slot-a",
        configVersion: 1,
      });

    await getWebCustomerSessionState(session);
    await getWebCustomerHistory(session);
    await getWebCustomerRewards(session);
    await spinWebCustomerWheel(session, 1, "idempotency-key-123456");

    expect(mocks.callCustomerWebFunction.mock.calls.map(([name]) => name)).toEqual([
      "getWebCustomerSession",
      "getWebCustomerHistory",
      "getWebCustomerRewards",
      "spinWebLuckyWheel",
    ]);
    for (const [, payload] of mocks.callCustomerWebFunction.mock.calls) {
      expect(payload).not.toHaveProperty("uid");
      expect(payload).not.toHaveProperty("zaloAccessToken");
    }
  });
});
