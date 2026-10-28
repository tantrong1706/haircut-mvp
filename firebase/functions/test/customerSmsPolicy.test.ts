import { describe, expect, it } from "vitest";
import { smsSendDecision, smsQuotaKeys } from "../src/domains/auth/customerSmsPolicy";

describe("server-side SMS cost policy", () => {
  const input = {
    phone: "+84901234567", phoneCount: 0, peerCount: 0, dailyCount: 0,
    phoneLimit: 3, peerLimit: 20, dailyLimit: 100,
  };
  it("accepts an in-budget Vietnamese destination without overriding CAPTCHA", () => {
    expect(smsSendDecision(input)).toBe("allow");
  });
  it.each([
    { phone: "+12025550123" }, { phone: "0901234567" },
    { phoneCount: 3 }, { peerCount: 20 }, { dailyCount: 100 },
    { dailyLimit: 0 }, { dailyLimit: Number.NaN }, { phoneCount: -1 },
  ])("blocks invalid or exhausted destinations: %o", (patch) => {
    expect(smsSendDecision({ ...input, ...patch })).toBe("block");
  });
  it("uses stable private bucket keys, normalizes equivalent IPs and separates daily windows", () => {
    const keys = smsQuotaKeys("+84901234567", "::ffff:192.0.2.1", 1_800_000);
    expect(keys).toEqual(smsQuotaKeys("+84901234567", "192.0.2.1", 1_800_000));
    expect(JSON.stringify(keys)).not.toContain("84901234567");
    expect(keys.daily).not.toBe(smsQuotaKeys("+84901234567", "192.0.2.1", 86_400_000).daily);
  });
});
