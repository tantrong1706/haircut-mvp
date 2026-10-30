import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const qr =
  "/checkin?qrType=branch&salonId=salon-web-a&branchId=demo-branch-main&qrToken=signed-web-a";
const choiceKey = "haircut_privacy_preferences_v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
  });
});

async function signIn(page: Page) {
  await page.goto(qr);
  await page.getByRole("button", { name: "Chỉ dùng thiết yếu" }).click();
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await expect(page.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i })).toBeVisible();
}

test("essential-only choice is keyboard usable and survives a reload", async ({ page }) => {
  const optionalHosts: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (/google-analytics\.com|googletagmanager\.com|sentry\.io/u.test(host))
      optionalHosts.push(host);
  });
  await page.goto("/privacy");
  const decline = page.getByRole("button", { name: "Chỉ dùng thiết yếu" });
  await decline.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cài đặt quyền riêng tư" })).toBeFocused();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null")?.optional,
      choiceKey,
    ),
  ).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Chính sách quyền riêng tư" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cho phép thống kê" })).toHaveCount(0);
  expect(optionalHosts).toEqual([]);
});

test("cookie page opens controls and withdrawal preserves other browser storage", async ({
  page,
}) => {
  await page.goto("/cookies");
  await page.evaluate(() => localStorage.setItem("firebase:authUser:fixture", "preserve-fixture"));
  await page.getByRole("button", { name: "Chỉ dùng thiết yếu" }).click();
  await page.getByRole("button", { name: "Mở cài đặt cookie" }).click();
  await page.getByRole("button", { name: "Cho phép thống kê" }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null")?.optional,
      choiceKey,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Cài đặt quyền riêng tư" }).click();
  await page.getByRole("button", { name: "Chỉ dùng thiết yếu" }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "null")?.optional,
      choiceKey,
    ),
  ).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("firebase:authUser:fixture"))).toBe(
    "preserve-fixture",
  );
});

test("customer can request points without photos and restore the remembered sign-in", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i })).not.toBeChecked();
  await page.getByRole("button", { name: "Yêu cầu tích điểm" }).click();
  await page
    .getByRole("navigation", { name: "Điều hướng" })
    .getByRole("button", { name: "Tài khoản", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Ngừng cho phép lưu ảnh" })).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Yêu cầu xem, sửa hoặc xóa dữ liệu" }),
  ).toHaveAttribute("href", "/data-rights");
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Điều hướng" })).toBeVisible();
  await expect(page.getByLabel("Số điện thoại")).toHaveCount(0);
});

test("explicit photo choice can be withdrawn without changing the displayed points", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i }).check();
  await page.getByRole("button", { name: "Yêu cầu tích điểm" }).click();
  await page
    .getByRole("navigation", { name: "Điều hướng" })
    .getByRole("button", { name: "Tài khoản", exact: true })
    .click();
  const balance = await page.locator(".account-balance").innerText();
  await page.getByRole("button", { name: "Ngừng cho phép lưu ảnh" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã ngừng cho phép lưu ảnh." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ngừng cho phép lưu ảnh" })).toBeDisabled();
  await expect(page.locator(".account-balance")).toHaveText(balance, { useInnerText: true });
});

test("public policies and data-rights routes need no management login and fit the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/data-rights");
  await page.getByRole("button", { name: "Chỉ dùng thiết yếu" }).click();
  for (const [route, heading] of [
    ["/privacy", "Chính sách quyền riêng tư"],
    ["/terms", "Điều khoản sử dụng"],
    ["/cookies", "Cookie và lưu trữ trên thiết bị"],
    ["/data-rights", "Quyền dữ liệu của bạn"],
    ["/delete-account", "Quyền dữ liệu của bạn"],
    ["/service-policy", "Chính sách dịch vụ"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "tantrong1706@gmail.com", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Đơn vị vận hành:|Điện thoại hỗ trợ:|Địa chỉ liên hệ:/),
    ).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  }
  await page.screenshot({ path: testInfo.outputPath("privacy-public-pages.png"), fullPage: true });
});
