import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const functionsSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

function callableBody(name: string) {
  const start = functionsSource.indexOf(`export const ${name} =`);
  const end = functionsSource.indexOf("\nexport const ", start + 1);

  expect(start, `Không tìm thấy callable ${name}`).toBeGreaterThanOrEqual(0);
  return functionsSource.slice(start, end >= 0 ? end : undefined);
}

describe("hợp đồng xác minh Zalo", () => {
  it("xác minh token bằng App Secret ở backend", () => {
    const start = functionsSource.indexOf("async function verifyZaloAccessToken");
    const end = functionsSource.indexOf("\nfunction last4", start);
    const verificationBody = functionsSource.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(verificationBody).toContain('createHmac("sha256", appSecret)');
    expect(verificationBody).toContain("access_token: accessToken");
    expect(verificationBody).toContain("appsecret_proof: appsecretProof");
    expect(verificationBody).toContain('"https://graph.zalo.me/v2.0/me"');
  });

  it.each([
    ["registerCustomerFromZalo", "const qrResolution = await resolveCustomerQrData"],
    ["spinLuckyWheelFromZalo", "return spinWheelForCustomer"],
    ["getCustomerSessionFromZalo", "const [customerSnap"],
    ["getCustomerHistoryFromZalo", "const [recordsSnap"],
    ["getCustomerRewardsFromZalo", "const rewardsSnap"],
  ])("%s xác minh Zalo trước khi đọc hoặc ghi nghiệp vụ khách", (name, businessMarker) => {
    const body = callableBody(name);
    const verificationIndex = body.indexOf("verifyZaloAccessToken(request.data?.zaloAccessToken)");
    const businessIndex = body.indexOf(businessMarker);

    expect(verificationIndex).toBeGreaterThanOrEqual(0);
    expect(businessIndex).toBeGreaterThan(verificationIndex);
  });

  it("giải mã phone token ở backend trước khi lưu khách", () => {
    const body = callableBody("registerCustomerFromZalo");
    const decodeIndex = body.indexOf("decodeZaloPhoneNumber(accessToken, phoneToken, appSecret");
    const contactIndex = body.indexOf("buildCustomerContactPatch");

    expect(decodeIndex).toBeGreaterThanOrEqual(0);
    expect(contactIndex).toBeGreaterThan(decodeIndex);
    expect(body).toContain('phoneLast4: String(customerSnap.data()?.phoneLast4 || "")');
  });
});
