import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("browse all salon pages and apply only the explicitly confirmed correction", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Salon", exact: true }).click();
  await page.getByRole("button", { name: "Tải thêm salon" }).click();
  await expect(page.getByRole("button", { name: "Kiểm tra Salon B" })).toBeVisible();
  await page.getByLabel("Tìm trong salon đã tải").fill("Salon A");
  await expect(page.getByRole("button", { name: "Kiểm tra Salon B" })).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra Salon A" }).click();
  await page.getByRole("button", { name: "Đồng bộ bộ đếm khách" }).click();
  await expect(page.getByRole("button", { name: "Xác nhận sửa" })).toBeDisabled();
  await page.getByLabel("Nhập tên salon để xác nhận").fill("Salon A");
  await page.getByLabel("Lý do sửa").fill("Đối chiếu hồ sơ trong kiểm thử trình duyệt");
  await page.getByRole("checkbox", { name: /Tôi đã kiểm tra đúng salon/ }).check();
  await page.getByRole("button", { name: "Xác nhận sửa" }).click();
  await expect(page.getByText(/Không phát hiện bất thường trong phạm vi/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { lastFixtureRepair?: { action: string; salonId: string } }).lastFixtureRepair)).toMatchObject({ action: "reconcile_customer_count", salonId: "salon-a" });
});

test("service failure is not displayed as an empty healthy system", async ({ page }) => {
  await page.goto("/?scenario=offline");
  await page.getByRole("button", { name: "Salon", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Chưa tải được danh sách salon");
  await expect(page.getByText("Chưa có salon", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sự cố", exact: true }).click();
  await expect(page.getByRole("link", { name: "Mở công cụ Google" })).toHaveCount(3);
});

test("read-only server capability and accessible layout", async ({ page }, testInfo) => {
  await page.goto("/?scenario=readonly");
  await page.getByRole("button", { name: "Salon", exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra Salon A" }).click();
  await expect(page.getByRole("button", { name: "Đồng bộ bộ đếm khách" })).toBeDisabled();
  if (testInfo.project.name.startsWith("mobile")) {
    await expect(page.getByText("Salon A", { exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Đăng xuất", exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("admin-preview.png"), fullPage: true });
});
