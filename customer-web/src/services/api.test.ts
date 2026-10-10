import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerSessionRefreshDelay,
  getCustomerWheelConfig,
  getHaircutHistory,
  getRewards,
  listenSessionLiveUpdates,
  spinWheel,
} from "./api";
import { defaultLuckyWheelConfig, type AppSession } from "./types";

const web = vi.hoisted(() => ({
  getWebCustomerHistory: vi.fn(),
  getWebCustomerRewards: vi.fn(),
  getWebCustomerSessionState: vi.fn(),
  spinWebCustomerWheel: vi.fn(),
}));
vi.mock("./webCustomerApi", () => web);
const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-test",
  zaloUserId: "",
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
  sessionId: "session-a",
  sessionStatus: "pending_approval",
  customer: {
    customerId: "customer-a",
    name: "Khách Web",
    phoneLast4: "4567",
    points: 7,
    allowPhoto: true,
  },
};
const result = {
  rewardId: "reward-test",
  rewardName: "Gội đầu",
  rewardCode: "TEST-ONLY",
  pointsAfter: 2,
  isWinning: true,
  selectedIndex: 1,
  selectedSlotId: "slot-2",
  configVersion: 1,
};
const pendingKey = "haircut_pending_operation:spin:salon-a:customer-a";

describe("Firebase Web customer adapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    web.getWebCustomerSessionState.mockResolvedValue({
      ...session,
      wheelConfig: defaultLuckyWheelConfig,
    });
    web.spinWebCustomerWheel.mockResolvedValue(result);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passes Web history and rewards through without tokens or direct database fallback", async () => {
    const records = [{ id: "record-a", photoUrls: ["https://example.com/photo.jpg"] }];
    web.getWebCustomerHistory.mockResolvedValue(records);
    web.getWebCustomerRewards.mockResolvedValue([result]);
    expect(await getHaircutHistory(session)).toBe(records);
    expect(await getRewards(session)).toEqual([result]);
    expect(web.getWebCustomerHistory).toHaveBeenCalledWith(session);
    expect(web.getWebCustomerRewards).toHaveBeenCalledWith(session);
  });
  it("propagates backend failure without inventing history or points", async () => {
    web.getWebCustomerHistory.mockRejectedValue(new Error("unavailable"));
    web.getWebCustomerSessionState.mockRejectedValue(new Error("unavailable"));
    await expect(getHaircutHistory(session)).rejects.toThrow("unavailable");
    await expect(getCustomerWheelConfig(session)).rejects.toThrow("unavailable");
  });
  it("normalizes wheel config from authenticated backend", async () => {
    expect(await getCustomerWheelConfig(session)).toEqual(defaultLuckyWheelConfig);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledWith(session);
  });
  it("retries failed spins with the same key, clearing it only after success", async () => {
    web.spinWebCustomerWheel.mockRejectedValueOnce(new Error("timeout"));
    await expect(spinWheel(session, 1)).rejects.toThrow("timeout");
    const key = localStorage.getItem(pendingKey);
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(await spinWheel(session, 1)).toEqual(result);
    expect(web.spinWebCustomerWheel.mock.calls.map((call) => call[2])).toEqual([key, key]);
    expect(localStorage.getItem(pendingKey)).toBeNull();
  });
  it("rejects malformed stored operation keys and preserves server win classification", async () => {
    localStorage.setItem(pendingKey, "invalid");
    web.spinWebCustomerWheel.mockResolvedValue({ ...result, isWinning: false });
    expect((await spinWheel(session, 1)).isWinning).toBe(false);
    expect(web.spinWebCustomerWheel.mock.calls[0][2]).not.toBe("invalid");
    web.spinWebCustomerWheel.mockResolvedValue({ ...result, isWinning: undefined, rewardCode: "" });
    expect((await spinWheel(session, 1)).isWinning).toBe(false);
  });
  it("uses bounded status-specific delay, jitter and backoff", () => {
    expect(customerSessionRefreshDelay("completed", 0, 0)).toBeNull();
    expect(customerSessionRefreshDelay("cancelled", 0, 0)).toBeNull();
    expect(customerSessionRefreshDelay("pending_approval", 0, 0.5)).toBe(32500);
    expect(customerSessionRefreshDelay("serving", 0, 0)).toBe(24000);
    expect(customerSessionRefreshDelay(undefined, 0, NaN)).toBe(20000);
    expect(customerSessionRefreshDelay("waiting", 0, -1)).toBe(20000);
    expect(customerSessionRefreshDelay("waiting", 1, 0)).toBe(40000);
    expect(customerSessionRefreshDelay("waiting", 8, 2)).toBe(94999);
  });
  it("polls server-authoritative points then stops after completion and cleanup", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onChange = vi.fn();
    const onSynced = vi.fn();
    const stop = listenSessionLiveUpdates(session, onChange, vi.fn(), onSynced);
    await vi.advanceTimersByTimeAsync(0);
    expect(onSynced).toHaveBeenCalledTimes(1);
    web.getWebCustomerSessionState.mockResolvedValue({
      ...session,
      sessionStatus: "completed",
      customer: { ...session.customer, points: 8 },
    });
    await vi.advanceTimersByTimeAsync(30000);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionStatus: "completed",
        customer: expect.objectContaining({ points: 8 }),
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
    stop();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(90000);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(2);
  });
  it("backs off on error and pauses calls while offline or hidden", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const onError = vi.fn();
    web.getWebCustomerSessionState.mockRejectedValueOnce(new Error("unavailable"));
    const stop = listenSessionLiveUpdates(session, vi.fn(), onError);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith("unavailable");
    await vi.advanceTimersByTimeAsync(39999);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(2);
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(30000);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(2);
    online.mockReturnValue(true);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(30000);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(web.getWebCustomerSessionState).toHaveBeenCalledTimes(3);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
