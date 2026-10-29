import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  signInWithCustomToken: vi.fn(),
  persistence: vi.fn(),
  auth: { currentUser: null },
}));
vi.mock("./firebase", () => ({
  callCustomerWebFunction: mocks.call,
  getCustomerFirebaseAuth: () => mocks.auth,
}));
vi.mock("./customerWebAuth", () => ({ configureCustomerWebAuthPersistence: mocks.persistence }));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.signInWithCustomToken }));
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: mocks.startAuthentication,
  startRegistration: mocks.startRegistration,
}));

import {
  signInCustomerPasskey,
  registerCustomerPasskey,
  customerPasskeysAvailable,
  customerPasskeyError,
  listCustomerPasskeys,
  removeCustomerPasskey,
} from "./customerPasskeys";

describe("optional customer passkeys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("only offers passkeys for an enabled rollout on a secure, compatible browser", () => {
    vi.stubEnv("VITE_CUSTOMER_PASSKEYS_ENABLED", "false");
    expect(customerPasskeysAvailable()).toBe(false);
    vi.stubEnv("VITE_CUSTOMER_PASSKEYS_ENABLED", "true");
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("PublicKeyCredential", class {});
    expect(customerPasskeysAvailable()).toBe(true);
    vi.stubGlobal("isSecureContext", false);
    expect(customerPasskeysAvailable()).toBe(false);
  });
  it("lists and removes only via the customer-scoped server API", async () => {
    mocks.call.mockResolvedValueOnce({ keys: [] }).mockResolvedValueOnce({ ok: true });
    await expect(listCustomerPasskeys()).resolves.toEqual({ keys: [] });
    await expect(removeCustomerPasskey("owned-key")).resolves.toEqual({ ok: true });
    expect(mocks.call).toHaveBeenNthCalledWith(1, "listCustomerPasskeys", {});
    expect(mocks.call).toHaveBeenLastCalledWith("removeCustomerPasskey", { id: "owned-key" });
  });
  it("shows safe cancellation and generic failure text without exposing tokens", () => {
    expect(customerPasskeyError(new DOMException("Cancel", "NotAllowedError"))).toContain("hủy");
    expect(customerPasskeyError(new Error("private internal detail"))).not.toContain(
      "private internal detail",
    );
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("uses the customer-only Firebase instance and restores local persistence before signing in", async () => {
    mocks.call
      .mockResolvedValueOnce({ challengeId: "one-use", options: { challenge: "challenge" } })
      .mockResolvedValueOnce({ token: "synthetic-token" });
    mocks.startAuthentication.mockResolvedValue({ id: "credential-id" });
    await signInCustomerPasskey();
    expect(mocks.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: { challenge: "challenge" },
    });
    expect(mocks.call).toHaveBeenLastCalledWith("finishCustomerPasskeySignIn", {
      challengeId: "one-use",
      response: { id: "credential-id" },
    });
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith(mocks.auth, "synthetic-token");
    expect(mocks.persistence.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signInWithCustomToken.mock.invocationCallOrder[0],
    );
  });
  it("cancellation never sends SMS or silently tries another authentication method", async () => {
    mocks.call.mockResolvedValue({ challengeId: "one-use", options: {} });
    mocks.startAuthentication.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
    await expect(signInCustomerPasskey()).rejects.toThrow();
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithCustomToken).not.toHaveBeenCalled();
  });
  it("registers only against server-generated options and never provides a UID or phone", async () => {
    mocks.call
      .mockResolvedValueOnce({ challengeId: "enroll", options: { challenge: "challenge" } })
      .mockResolvedValueOnce({ ok: true });
    mocks.startRegistration.mockResolvedValue({ id: "new-credential" });
    await registerCustomerPasskey();
    expect(mocks.call).toHaveBeenNthCalledWith(1, "beginCustomerPasskeyRegistration", {});
    expect(mocks.call).toHaveBeenLastCalledWith("finishCustomerPasskeyRegistration", {
      challengeId: "enroll",
      response: { id: "new-credential" },
    });
  });
});
