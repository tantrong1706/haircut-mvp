import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const qr =
  "/checkin?qrType=branch&salonId=salon-web-a&branchId=demo-branch-main&qrToken=signed-web-a";

test("Light customer typography keeps Vietnamese headings and actions readable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
  });
  await page.goto(qr);
  await expect(page.getByLabel("Số điện thoại")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const heading = await page.locator("h1").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      weight: style.fontWeight,
      family: style.fontFamily,
      tracking: parseFloat(style.letterSpacing),
    };
  });
  expect(heading.weight).toBe("300");
  expect(heading.family).toContain("Be Vietnam Pro");
  expect(heading.tracking).toBeGreaterThanOrEqual(-0.9);
  expect(
    await page
      .getByRole("button", { name: "Gửi mã OTP" })
      .evaluate((element) => getComputedStyle(element).fontWeight),
  ).toBe("400");
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (font) =>
          font.family.includes("Be Vietnam Pro") &&
          font.weight === "300" &&
          font.status === "loaded",
      ),
    ),
  ).toBe(true);
});

test("Customer entry uses a fluid title and readable text at 320px", async ({ page }, info) => {
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
  });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto(qr);
  const heading = page.getByRole("heading", { name: "Đăng nhập bằng số điện thoại" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS("font-size", "28px");
  await expect(heading).toHaveCSS("line-height", "35.84px");
  await expect(page.getByText("Chỉ cần xác thực lần đầu trên thiết bị này.")).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.getByText("Số điện thoại", { exact: true })).toHaveCSS("font-size", "14px");
  await expect(page.getByLabel("Số điện thoại")).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("button", { name: "Gửi mã OTP" })).toHaveCSS("font-size", "14px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: info.outputPath("customer-entry-320.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(heading).toHaveCSS("font-size", "36px");
});

test("Management entry respects a larger browser text setting without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/owner");
  const heading = page.getByRole("heading", { name: "Đăng nhập quản lý" });
  await expect(heading).toHaveCSS("font-size", "28px");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCSS("font-size", "16px");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "125%";
  });
  await expect(heading).toHaveCSS("font-size", "35px");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCSS("font-size", "20px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

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
  await page.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i }).check();
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
