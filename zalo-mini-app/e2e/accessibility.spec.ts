import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const qr =
  "/checkin?qrType=branch&salonId=salon-web-a&branchId=demo-branch-main&qrToken=signed-web-a";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("màn yêu cầu QR không có lỗi accessibility nghiêm trọng", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cần QR của salon" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("màn Phone OTP không có lỗi accessibility nghiêm trọng", async ({ page }) => {
  await page.goto(qr);
  await expect(page.getByLabel("Số điện thoại")).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("màn tài khoản khách không có lỗi accessibility nghiêm trọng", async ({ page }) => {
  await page.goto(qr);
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await page.getByRole("button", { name: "Xem điểm, lịch sử và quà" }).click();
  await expect(page.getByText("Điểm, lịch sử và quà của bạn tại salon.")).toBeVisible();
  await expectNoSeriousViolations(page);
});

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page }).include("main").analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking, blocking.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
}
