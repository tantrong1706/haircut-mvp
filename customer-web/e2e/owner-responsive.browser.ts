import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto("/e2e/fixtures/owner-responsive.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "CH Hair Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeEnabled();
});

test("all owner menu items fit without horizontal scrolling", async ({ page }, info) => {
  await page.screenshot({ path: info.outputPath("owner-home.png"), fullPage: true });
  const menu = page.locator(".owner-tabs");
  await expect(menu.getByRole("button")).toHaveCount(8);
  expect(await menu.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const button of await menu.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test("daily numbers have readable labels and quick actions precede retention", async ({ page }) => {
  const sizes = await page
    .locator(".overview-metric > span")
    .evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
  expect(sizes).toHaveLength(7);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  const quick = await page.locator(".owner-next-actions").boundingBox();
  const retention = await page.locator(".retention-panel").boundingBox();
  expect(quick!.y).toBeLessThan(retention!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("all management tabs remain usable without page overflow", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const menu = page.getByRole("navigation", { name: "Chọn mục quản lý" });
  for (const label of [
    "Duyệt điểm",
    "Chi nhánh",
    "Nhân viên",
    "Khách hàng",
    "Vòng quay",
    "Đổi quà",
    "Cài đặt",
    "Tổng quan",
  ]) {
    const button = menu.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      label,
    ).toBe(true);
  }
  await menu.getByRole("button", { name: "Vòng quay", exact: true }).click();
  const inputs = page.locator(".wheel-slot-row input:not([type=checkbox]), .wheel-slot-row select");
  for (const input of await inputs.all()) {
    const box = await input.boundingBox();
    expect(box!.width, "Wheel form fields must not collapse").toBeGreaterThanOrEqual(70);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath("owner-wheel.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("overview is accessible and confirmation can be cancelled without writes", async ({
  page,
}) => {
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    audit.violations.filter((item) => ["critical", "serious"].includes(item.impact || "")),
  ).toEqual([]);
  await expect(
    page.getByText("fixture-owner-salon-not-an-account-number", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("navigation", { name: "Chọn mục quản lý" })
    .getByRole("button", { name: "Duyệt điểm", exact: true })
    .click();
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".approval-card")).toHaveCount(1);
});

test("customer directory opens without typing a search and shows the salon total", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Khách hàng", exact: true })
    .click();
  await expect(page.getByText("Khách mẫu trong danh bạ", { exact: true })).toBeVisible();
  await expect(page.getByText("Tổng: 1 khách", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("directory offers points with an explicit customer and branch confirmation, cancel writes nothing", async ({
  page,
}, info) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Khách hàng", exact: true })
    .click();
  await page.getByRole("button", { name: "Tích điểm cho Khách mẫu trong danh bạ" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("******5678");
  await expect(dialog).toContainText("Chi nhánh Nguyễn Văn Linh");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("7 điểm", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("owner-customers.png"), fullPage: true });
});

test("owner saves a note before points, keeps it across tabs and blocks approval if saving fails", async ({
  page,
}) => {
  const menu = page.getByRole("navigation");
  await menu.getByRole("button", { name: "Duyệt điểm", exact: true }).click();
  const note = page.getByLabel("Ghi chú kiểu tóc (không bắt buộc)");
  await note.fill("Ghi chú đã lưu từ kiểm thử");
  await page.getByRole("button", { name: "Lưu ghi chú", exact: true }).click();
  await expect(page.getByText("Đã lưu ghi chú.", { exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await menu.getByRole("button", { name: "Duyệt điểm", exact: true }).click();
  await expect(note).toHaveValue("Ghi chú đã lưu từ kiểm thử");
  await note.fill("simulate-failure");
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(page.getByText("Không lưu được ghi chú mẫu", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(note).toHaveValue("simulate-failure");
});
