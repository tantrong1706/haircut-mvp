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
    expect(verificationBody).toContain('endpoint.searchParams.set("fields", "id")');
    expect(verificationBody).not.toContain('"id,name,picture"');
    expect(verificationBody).not.toContain("payload.picture");
  });

  it("chuẩn hóa lỗi xác minh và gắn requestId mà không lộ credential", () => {
    const start = functionsSource.indexOf("async function verifyZaloAccessToken");
    const end = functionsSource.indexOf("\nfunction last4", start);
    const verificationBody = functionsSource.slice(start, end);
    const registerBody = callableBody("registerCustomerFromZalo");

    expect(verificationBody).toContain("requestId");
    expect(verificationBody).toContain('event: "zalo_identity_verification_failed"');
    expect(verificationBody).toContain("ZALO_VERIFICATION_USER_MESSAGE");
    expect(verificationBody).toContain('errorCode: "ZALO_VERIFICATION_FAILED"');
    expect(verificationBody).toContain("for (const sensitiveValue of [accessToken, appSecret, appsecretProof])");
    expect(registerBody).toContain("createZaloVerificationRequestId()");
    expect(registerBody).toContain('functionName: "registerCustomerFromZalo"');
    expect(registerBody).not.toContain("request.data?.zaloUserId");
  });

  it.each([
    ["registerCustomerFromZalo", "const qrResolution = await resolveCustomerQrData"],
    ["spinLuckyWheelFromZalo", "return spinWheelForCustomer"],
    ["getCustomerSessionFromZalo", "const [customerSnap"],
    ["getCustomerHistoryFromZalo", "const [recordsSnap"],
    ["getCustomerRewardsFromZalo", "const rewardsSnap"],
  ])("%s xác minh Zalo trước khi đọc hoặc ghi nghiệp vụ khách", (name, businessMarker) => {
    const body = callableBody(name);
    const verificationIndex = body.indexOf("await verifyZaloAccessToken(");
    const businessIndex = body.indexOf(businessMarker);

    expect(verificationIndex).toBeGreaterThanOrEqual(0);
    expect(businessIndex).toBeGreaterThan(verificationIndex);
  });

  it("vòng quay production dùng entropy mật mã phía server", () => {
    const start = functionsSource.indexOf("async function spinWheelForCustomer");
    const end = functionsSource.indexOf("\nexport const createSalon", start);
    const spinBody = functionsSource.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(spinBody).toContain("randomUnitIntervalFromBytes(randomBytes(6))");
    expect(spinBody).not.toContain("Math.random()");
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
