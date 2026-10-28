import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  call: vi.fn(), startAuthentication: vi.fn(), startRegistration: vi.fn(),
  signInWithCustomToken: vi.fn(), persistence: vi.fn(), auth: { currentUser: null },
}));
vi.mock("./firebase", () => ({ callCustomerWebFunction: mocks.call, getCustomerFirebaseAuth: () => mocks.auth }));
vi.mock("./customerWebAuth", () => ({ configureCustomerWebAuthPersistence: mocks.persistence }));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.signInWithCustomToken }));
vi.mock("@simplewebauthn/browser", () => ({ startAuthentication: mocks.startAuthentication, startRegistration: mocks.startRegistration }));

import { signInCustomerPasskey, registerCustomerPasskey } from "./customerPasskeys";

describe("optional customer passkeys", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("uses the customer-only Firebase instance and restores local persistence before signing in", async () => {
    mocks.call.mockResolvedValueOnce({ challengeId: "one-use", options: { challenge: "challenge" } }).mockResolvedValueOnce({ token: "synthetic-token" });
    mocks.startAuthentication.mockResolvedValue({ id: "credential-id" });
    await signInCustomerPasskey();
    expect(mocks.startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: "challenge" } });
    expect(mocks.call).toHaveBeenLastCalledWith("finishCustomerPasskeySignIn", { challengeId: "one-use", response: { id: "credential-id" } });
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith(mocks.auth, "synthetic-token");
    expect(mocks.persistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.signInWithCustomToken.mock.invocationCallOrder[0]);
  });
  it("cancellation never sends SMS or silently tries another authentication method", async () => {
    mocks.call.mockResolvedValue({ challengeId: "one-use", options: {} });
    mocks.startAuthentication.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
    await expect(signInCustomerPasskey()).rejects.toThrow();
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithCustomToken).not.toHaveBeenCalled();
  });
  it("registers only against server-generated options and never provides a UID or phone", async () => {
    mocks.call.mockResolvedValueOnce({ challengeId: "enroll", options: { challenge: "challenge" } }).mockResolvedValueOnce({ ok: true });
    mocks.startRegistration.mockResolvedValue({ id: "new-credential" });
    await registerCustomerPasskey();
    expect(mocks.call).toHaveBeenNthCalledWith(1, "beginCustomerPasskeyRegistration", {});
    expect(mocks.call).toHaveBeenLastCalledWith("finishCustomerPasskeyRegistration", { challengeId: "enroll", response: { id: "new-credential" } });
  });
});
