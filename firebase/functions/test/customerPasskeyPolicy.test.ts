import { describe, expect, it } from "vitest";
import { assertPasskeyEnrollment, assertPasskeyAccount, passkeyUserHandle } from "../src/domains/auth/customerPasskeyPolicy";

const now = 1_800_000;
const phoneAuth = { uid: "existing-uid", token: { phone_number: "+84901234567", firebase: { sign_in_provider: "phone" }, auth_time: now / 1_000 } };
describe("customer-only passkey trust boundary", () => {
  it("enrolls only a recent verified Phone login, preserving its UID", () => {
    expect(assertPasskeyEnrollment(phoneAuth, now).uid).toBe("existing-uid");
    expect(passkeyUserHandle("existing-uid")).toBe(passkeyUserHandle("existing-uid"));
    expect(passkeyUserHandle("existing-uid")).not.toBe(passkeyUserHandle("different-uid"));
  });
  it.each([
    null,
    { ...phoneAuth, token: { ...phoneAuth.token, firebase: { sign_in_provider: "custom" } } },
    { ...phoneAuth, token: { ...phoneAuth.token, auth_time: 1 } },
    { ...phoneAuth, token: { ...phoneAuth.token, auth_time: now / 1_000 + 120 } },
  ])("rejects stale, future or unverified enrollment", (auth) => {
    expect(() => assertPasskeyEnrollment(auth, now)).toThrow();
  });
  it("accepts only the same live unprivileged phone account", () => {
    expect(() => assertPasskeyAccount({ uid: "existing-uid", phoneNumber: "+84901234567", disabled: false }, "+84901234567", false)).not.toThrow();
  });
  it.each([
    [{ uid: "existing-uid", phoneNumber: "+84901234567", disabled: true }, false],
    [{ uid: "existing-uid", phoneNumber: "+84909999999", disabled: false }, false],
    [{ uid: "existing-uid", phoneNumber: "+84901234567", disabled: false }, true],
  ] as const)("rejects disabled/changed-phone/privileged accounts", (user, privileged) => {
    expect(() => assertPasskeyAccount(user, "+84901234567", privileged)).toThrow();
  });
});
