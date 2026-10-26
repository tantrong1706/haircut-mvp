import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { languageCode: "" },
  send: vi.fn(),
  call: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ sendPasswordResetEmail: mocks.send }));
vi.mock("./firebase", () => ({
  getFirebaseAuth: () => mocks.auth,
  getFirebaseDb: vi.fn(),
  isFirebaseConfigured: () => true,
  callFunction: mocks.call,
}));
import { createStaffProfile, sendStaffInviteEmail } from "./operations";

describe("staff invitation email request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue(undefined);
    mocks.call.mockResolvedValue({ uid: "staff-fixture", email: "staff@example.invalid" });
  });
  it("normalizes the address and does not send an unapproved localhost continue URL", async () => {
    await sendStaffInviteEmail("  Staff@Example.Invalid  ");
    expect(mocks.send).toHaveBeenCalledWith(mocks.auth, "staff@example.invalid");
  });
  it("rejects malformed addresses before requesting an email", async () => {
    await expect(sendStaffInviteEmail("bad-address")).rejects.toThrow(/email/i);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports a useful rate-limit error without logging raw provider details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.send.mockRejectedValue({
        code: "auth/too-many-requests",
        customData: { email: "staff@example.invalid" },
      });
      await expect(sendStaffInviteEmail("staff@example.invalid")).rejects.toThrow(/giới hạn/i);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
  it("preserves the created account and a safe email failure reason rather than recreating staff", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.send.mockRejectedValue({ code: "auth/network-request-failed" });
      const result = await createStaffProfile({
        salonId: "salon-fixture",
        email: "staff@example.invalid",
        name: "Synthetic staff",
        canRedeemRewards: false,
        canAwardPointsDirectly: false,
        branchIds: ["branch-fixture"],
      });
      expect(result).toMatchObject({ uid: "staff-fixture", inviteEmailSent: false });
      expect(result).toHaveProperty("inviteEmailError", expect.stringMatching(/kết nối|mạng/i));
      expect(mocks.call).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
