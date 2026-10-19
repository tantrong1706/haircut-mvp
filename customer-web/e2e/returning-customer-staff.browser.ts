import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  // Only synthetic endpoints are allowed to receive the phone suffix in this test.
  await page.route("**/__fixture/search", (route) =>
    route.fulfill({
      json: {
        customers: [
          { id: "fixture-a", name: "Minh An", phoneLast4: "5678", points: 4 },
          { id: "fixture-b", name: "Quốc Bình", phoneLast4: "5678", points: 7 },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/e2e/fixtures/returning-customer.html");
});

test("search, disambiguate and confirm once on a real browser", async ({ page }, testInfo) => {
  const submissions: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__fixture/awardReturningCustomerPoints", (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ json: { pointsAdded: 1, pointsAfter: 8, alreadyProcessed: false } });
  });
  await page.getByLabel("4 số cuối điện thoại").fill("5678");
  await page.getByRole("button", { name: "Tìm khách" }).click();
  await expect(page.getByText(/Nhiều khách trùng 4 số/)).toBeVisible();
  await page.getByRole("button", { name: /Chọn Quốc Bình/ }).click();
  expect(submissions).toHaveLength(0);
  const violations = (await new AxeBuilder({ page }).include("main").analyze()).violations.filter(
    (item) => ["critical", "serious"].includes(item.impact || ""),
  );
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("returning-customer-confirm.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Xác nhận cộng 1 điểm" }).click();
  await expect(page.getByRole("status")).toContainText("Đã cộng 1 điểm cho Quốc Bình");
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    salonId: "salon-fixture",
    branchId: "branch-fixture",
    customerId: "fixture-b",
    phoneLast4: "5678",
  });
  expect(errors).toEqual([]);
});

test("a lost response retries with the same operation ID", async ({ page }) => {
  const operations: string[] = [];
  await page.route("**/__fixture/awardReturningCustomerPoints", (route) => {
    operations.push(route.request().postDataJSON().operationId);
    return operations.length === 1
      ? route.fulfill({ status: 503, body: "fixture-unavailable" })
      : route.fulfill({ json: { pointsAdded: 1, pointsAfter: 5, alreadyProcessed: true } });
  });
  await page.getByLabel("4 số cuối điện thoại").fill("5678");
  await page.getByRole("button", { name: "Tìm khách" }).click();
  await page.getByRole("button", { name: /Chọn Minh An/ }).click();
  await page.getByRole("button", { name: "Xác nhận cộng 1 điểm" }).click();
  await expect(page.getByRole("alert")).toContainText("Kết nối bị gián đoạn");
  await page.getByRole("button", { name: "Xác nhận cộng 1 điểm" }).click();
  await expect(page.getByRole("status")).toContainText("Lượt này đã được ghi nhận");
  expect(operations).toHaveLength(2);
  expect(operations[0]).toBe(operations[1]);
});
