import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const qr =
  "/checkin?qrType=branch&salonId=salon-web-a&branchId=demo-branch-main&qrToken=signed-web-a";

test("Web barber: Phone login, dark pages, no narrow-screen overflow or serious a11y errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(qr);
  await expect(page.getByRole("link", { name: "Quyền riêng tư", exact: true })).toHaveAttribute(
    "href",
    "/privacy",
  );
  await expect(page.getByLabel("Số điện thoại")).toBeVisible();
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await page.getByRole("button", { name: "Yêu cầu tích điểm" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Chờ xác nhận điểm" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Thẻ thành viên" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    "rgb(18, 18, 17)",
  );
  for (const label of ["Điểm", "Lịch sử", "Quà và quay", "Tài khoản"]) {
    await page
      .getByRole("navigation", { name: "Điều hướng" })
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.locator("h1")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("main")
          .getByText(/Đang tải/)
          .count(),
      )
      .toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page }).include("main").analyze();
    expect(
      result.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("web-account-360.png"), fullPage: true });
});
