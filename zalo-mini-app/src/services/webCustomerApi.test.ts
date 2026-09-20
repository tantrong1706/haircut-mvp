import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession, QrContext } from "./types";

const mocks = vi.hoisted(() => ({
  callCustomerWebFunction: vi.fn(),
}));

vi.mock("./firebase", () => ({
  callCustomerWebFunction: mocks.callCustomerWebFunction,
  getCustomerFirebaseAuth: () => ({ currentUser: { uid: "uid-a" } }),
  isFirebaseConfigured: () => true,
}));

import {
  checkInWebCustomer,
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSessionState,
  getWebCustomerAccount,
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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      false;
  });

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

  it("giữ chi nhánh backend đã resolve khi check-in từ QR salon", async () => {
    const salonQr: QrContext = { ...qr, qrType: "salon", branchId: "" };
    mocks.callCustomerWebFunction.mockResolvedValue({
      ...session,
      qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
    });

    const result = await checkInWebCustomer(salonQr);

    expect(result.qr).toEqual({
      qrType: "branch",
      salonId: "salon-a",
      branchId: "branch-a",
      mirrorId: "",
    });
    expect(mocks.callCustomerWebFunction).toHaveBeenCalledWith("checkInWebCustomer", salonQr);
  });

  it("mở tài khoản chỉ đọc qua auth, không gửi customerId hay tạo check-in", async () => {
    mocks.callCustomerWebFunction.mockResolvedValue({
      sessionId: "", firebaseUid: "uid-a", salonName: "Salon A",
      customer: rawContext.customer, wheelConfig: { requiredPoints: 5, slots: [] },
    });
    const result = await getWebCustomerAccount("salon-a");
    expect(result).toMatchObject({
      identityProvider: "firebase", sessionId: "", salonName: "Salon A",
      qr: { salonId: "salon-a", branchId: "" },
    });
    expect(mocks.callCustomerWebFunction).toHaveBeenCalledWith("getWebCustomerSession", { salonId: "salon-a" });
  });

  it("chuẩn hóa đầy đủ lịch sử và quà từ web callables", async () => {
    const createdAtMs = Date.UTC(2026, 8, 15);
    mocks.callCustomerWebFunction
      .mockResolvedValueOnce({
        records: [
          {
            id: "record-a",
            createdAtMs,
            salonName: "Salon A",
            branchId: "branch-a",
            branchName: "Chi nhánh A",
            staffName: "Nam",
            serviceName: "Cắt tóc",
            rewardName: "Quà A",
            note: "Fade thấp",
            photoUrls: ["https://example.com/photo.jpg"],
            pointsAdded: 2,
          },
          { id: "record-empty", createdAtMs: null },
        ],
      })
      .mockResolvedValueOnce({
        rewards: [
          {
            id: "reward-a",
            rewardName: "Quà A",
            rewardCode: "HC-TEST",
            status: "used",
            sourceBranchId: "branch-a",
            sourceBranchName: "Chi nhánh A",
            redemptionScope: "branches",
            allowedBranchIds: ["branch-a"],
            createdAtMs,
            usedAtMs: createdAtMs,
            usedBranchId: "branch-a",
            usedBranchName: "Chi nhánh A",
            expiresAtMs: createdAtMs,
          },
          {
            id: "reward-empty",
            rewardName: "Quà B",
            rewardCode: "HC-EMPTY",
            status: "unused",
            createdAtMs: null,
            usedAtMs: null,
            expiresAtMs: null,
          },
        ],
      });

    const history = await getWebCustomerHistory(session);
    const rewards = await getWebCustomerRewards(session);

    expect(history[0]).toMatchObject({
      branchName: "Chi nhánh A",
      staffName: "Nam",
      photoUrls: ["https://example.com/photo.jpg"],
      pointsAdded: 2,
    });
    expect(history[1]).toMatchObject({
      createdAt: "",
      salonName: "",
      photoUrls: [],
      pointsAdded: 0,
    });
    expect(rewards[0]).toMatchObject({
      redemptionScope: "branches",
      allowedBranchIds: ["branch-a"],
      usedBranchName: "Chi nhánh A",
    });
    expect(rewards[1]).toMatchObject({
      sourceBranchName: "Chi nhánh phát hành",
      redemptionScope: "salon",
      allowedBranchIds: [],
      createdAt: "",
    });
  });

  it("test adapter chỉ hoạt động khi runtime test bật rõ", async () => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
    localStorage.setItem("haircut_test_web_points:salon-a", "9");

    const context = await resolveWebCustomerContext(qr);
    const checkedIn = await checkInWebCustomer(qr);
    const repeated = await checkInWebCustomer(qr);

    expect(context.customer.points).toBe(9);
    expect(checkedIn.identityProvider).toBe("firebase");
    expect(repeated.sessionId).toBe(checkedIn.sessionId);
    await expect(getWebCustomerSessionState(checkedIn)).resolves.toMatchObject({
      customer: { points: 9 },
    });
    await expect(getWebCustomerHistory(checkedIn)).resolves.toEqual([]);
    await expect(getWebCustomerRewards(checkedIn)).resolves.toEqual([]);
    expect(mocks.callCustomerWebFunction).not.toHaveBeenCalled();
  });
});
