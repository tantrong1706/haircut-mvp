import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { requireFirestoreEmulator } from "./emulatorEnvironment";
import { createCustomerPasskeys } from "../src/domains/auth/customerPasskeys";
import { createCustomerSmsGate } from "../src/domains/auth/customerSmsGate";
import { passkeyUserHandle } from "../src/domains/auth/customerPasskeyPolicy";

const verify = vi.hoisted(() => ({ registration: vi.fn(), authentication: vi.fn() }));
vi.mock("@simplewebauthn/server", async (original) => ({
  ...await original<typeof import("@simplewebauthn/server")>(),
  verifyRegistrationResponse: verify.registration,
  verifyAuthenticationResponse: verify.authentication,
}));
const { emulatorHost, projectId } = requireFirestoreEmulator();
initializeApp({ projectId });
const db = getFirestore();
const account = { uid: "customer-uid", phoneNumber: "+84901234567", disabled: false, tokensValidAfterTime: "1970-01-01T00:00:00Z" };
const auth = { getUser: vi.fn(), createCustomToken: vi.fn() };
const api = createCustomerPasskeys(db, auth);
const request = (data: Record<string, unknown> = {}, signedIn = true) => ({ data, peer: "192.0.2.1", auth: signedIn ? {
  uid: account.uid, token: { phone_number: account.phoneNumber, firebase: { sign_in_provider: "phone" }, auth_time: Math.floor(Date.now() / 1_000), iat: Math.floor(Date.now() / 1_000) },
} : null });
const response = (id = "c3ludGhldGljLWNyZWRlbnRpYWw") => ({
  id, rawId: id, type: "public-key", clientExtensionResults: {},
  response: { clientDataJSON: Buffer.from(JSON.stringify({ crossOrigin: false })).toString("base64url"), userHandle: passkeyUserHandle(account.uid) },
});
async function enroll() {
  const start = await api.beginRegistration(request());
  return api.finishRegistration(request({ challengeId: start.challengeId, response: response() }));
}

describe("customer passkeys and SMS gate with isolated Firestore", () => {
  beforeEach(async () => {
    const cleared = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
    if (!cleared.ok) throw new Error("Emulator cleanup failed");
    vi.stubEnv("CUSTOMER_PASSKEYS_ENABLED", "true");
    vi.stubEnv("CUSTOMER_SMS_GATE_ENABLED", "true");
    vi.stubEnv("CUSTOMER_SMS_DAILY_LIMIT", "100");
    vi.clearAllMocks();
    auth.getUser.mockResolvedValue({ ...account });
    auth.createCustomToken.mockResolvedValue("synthetic-firebase-token");
    verify.registration.mockResolvedValue({ verified: true, registrationInfo: { credential: { id: response().id, publicKey: new Uint8Array([1, 2, 3]), counter: 0 }, userVerified: true } });
    verify.authentication.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 1, userVerified: true } });
  });
  afterAll(async () => { vi.unstubAllEnvs(); await Promise.all(getApps().map(deleteApp)); });

  it("preserves the same Firebase UID and verifies origin/RP/user verification on both ceremonies", async () => {
    await enroll();
    expect(verify.registration).toHaveBeenCalledWith(expect.objectContaining({ expectedOrigin: "https://app.chhaircutsalon.cc", expectedRPID: "app.chhaircutsalon.cc", requireUserVerification: true }));
    const start = await api.beginSignIn(request({}, false));
    await api.finishSignIn(request({ challengeId: start.challengeId, response: response() }, false));
    expect(auth.createCustomToken).toHaveBeenCalledWith(account.uid, expect.objectContaining({ customer_auth_method: "passkey-v1" }));
    expect(verify.authentication).toHaveBeenCalledWith(expect.objectContaining({ expectedOrigin: "https://app.chhaircutsalon.cc", expectedRPID: "app.chhaircutsalon.cc", requireUserVerification: true }));
  });
  it("rejects a replay even when two valid responses arrive concurrently", async () => {
    await enroll();
    const start = await api.beginSignIn(request({}, false));
    const req = request({ challengeId: start.challengeId, response: response() }, false);
    const results = await Promise.allSettled([api.finishSignIn(req), api.finishSignIn(req)]);
    expect(results.filter((value) => value.status === "fulfilled")).toHaveLength(1);
    expect(auth.createCustomToken).toHaveBeenCalledTimes(1);
  });
  it.each(["disabled", "changed-phone", "admin-grant", "staff-profile", "wrong-handle", "signature", "revoked"])("rejects %s without minting an authentication token", async (reason) => {
    await enroll();
    const keys = await api.list(request());
    if (reason === "disabled") auth.getUser.mockResolvedValue({ ...account, disabled: true });
    if (reason === "changed-phone") auth.getUser.mockResolvedValue({ ...account, phoneNumber: "+84909999999" });
    if (reason === "admin-grant") await db.doc(`system_admin_access/${account.uid}`).set({ role: "system_admin", isActive: true });
    if (reason === "staff-profile") await db.doc(`users/${account.uid}`).set({ role: "staff", isActive: true });
    if (reason === "revoked") await api.remove(request({ id: keys.keys[0].id }));
    if (reason === "signature") verify.authentication.mockRejectedValue(new Error("invalid signature"));
    const start = await api.beginSignIn(request({}, false));
    const assertion = response();
    if (reason === "wrong-handle") assertion.response.userHandle = "wrong-user";
    await expect(api.finishSignIn(request({ challengeId: start.challengeId, response: assertion }, false))).rejects.toThrow();
    expect(auth.createCustomToken).not.toHaveBeenCalled();
  });
  it("rejects enrollment without a recent Phone login and keeps credential ownership server-side", async () => {
    await expect(api.beginRegistration(request({}, false))).rejects.toThrow();
    const old = request();
    old.auth!.token.auth_time = 1;
    await expect(api.beginRegistration(old)).rejects.toThrow();
    await enroll();
    const keys = await api.list(request());
    const wrong = request(); wrong.auth!.uid = "different-customer";
    auth.getUser.mockResolvedValue({ ...account, uid: "different-customer" });
    await expect(api.remove({ ...wrong, data: { id: keys.keys[0].id } })).rejects.toThrow();
  });
  it("a signed purpose marker is insufficient after the underlying credential is revoked", async () => {
    await enroll();
    const keys = await api.list(request());
    const custom = { uid: account.uid, token: { phone_number: account.phoneNumber, customer_auth_method: "passkey-v1", customer_passkey_id: keys.keys[0].id, customer_passkey_verified_at: Math.floor(Date.now() / 1_000), firebase: { sign_in_provider: "custom" }, auth_time: Math.floor(Date.now() / 1_000), iat: Math.floor(Date.now() / 1_000) } };
    expect((await api.resolvePrincipal(custom)).uid).toBe(account.uid);
    await api.remove(request({ id: keys.keys[0].id }));
    await expect(api.resolvePrincipal(custom)).rejects.toThrow();
  });
  it("revoked recent Phone tokens cannot begin or finish enrollment", async () => {
    const old = request(); old.auth!.token.auth_time -= 120;
    const start = await api.beginRegistration(old);
    auth.getUser.mockResolvedValue({ ...account, tokensValidAfterTime: new Date(Date.now() - 60_000).toISOString() });
    await expect(api.beginRegistration(old)).rejects.toThrow();
    await expect(api.finishRegistration({ ...old, data: { challengeId: start.challengeId, response: response() } })).rejects.toThrow();
    expect((await db.collection("_customer_passkeys").get()).empty).toBe(true);
  });
  it("refreshing an ID token or exchanging a previously minted token cannot bypass revocation", async () => {
    await enroll(); const stored = await api.list(request());
    const now = Math.floor(Date.now() / 1_000);
    const token = { phone_number: account.phoneNumber, firebase: { sign_in_provider: "custom" }, customer_auth_method: "passkey-v1", customer_passkey_id: stored.keys[0].id, iat: now, auth_time: now - 120, customer_passkey_verified_at: now - 120 };
    auth.getUser.mockResolvedValue({ ...account, tokensValidAfterTime: new Date((now - 60) * 1_000).toISOString() });
    await expect(api.resolvePrincipal({ uid: account.uid, token })).rejects.toThrow();
    await expect(api.resolvePrincipal({ uid: account.uid, token: { ...token, auth_time: now } })).rejects.toThrow();
  });
  it("disabling new passkey enrollment does not strand a valid existing customer session", async () => {
    await enroll(); const stored = await api.list(request()); const now = Math.floor(Date.now() / 1_000);
    vi.stubEnv("CUSTOMER_PASSKEYS_ENABLED", "false");
    const token = { phone_number: account.phoneNumber, firebase: { sign_in_provider: "custom" }, customer_auth_method: "passkey-v1", customer_passkey_id: stored.keys[0].id, iat: now, auth_time: now, customer_passkey_verified_at: now };
    expect((await api.resolvePrincipal({ uid: account.uid, token })).uid).toBe(account.uid);
    await expect(api.beginSignIn(request({}, false))).rejects.toThrow();
  });
  it("caps actual SMS reservations atomically before transmission and never overrides CAPTCHA to ALLOW", async () => {
    const gate = createCustomerSmsGate(db);
    const event = { smsType: "SIGN_IN_OR_SIGN_UP", ipAddress: "192.0.2.1", additionalUserInfo: { phoneNumber: account.phoneNumber } };
    const results = await Promise.all(Array.from({ length: 6 }, () => gate(event)));
    expect(results.filter((value) => value.recaptchaActionOverride !== "BLOCK")).toHaveLength(3);
    expect(results).not.toContainEqual({ recaptchaActionOverride: "ALLOW" });
    vi.stubEnv("CUSTOMER_SMS_DAILY_LIMIT", "0");
    expect(await gate({ ...event, additionalUserInfo: { phoneNumber: "+84909999999" } })).toEqual({ recaptchaActionOverride: "BLOCK" });
  });
});
