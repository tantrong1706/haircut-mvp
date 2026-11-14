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

test("staff can enter a phone number for a new customer at the assigned branch", async ({
  page,
}, info) => {
  let request: unknown;
  await page.route("**/__fixture/createManualCustomer", (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ json: { customerId: "fixture-manual" } });
  });
  await page.getByRole("button", { name: "Thêm khách", exact: true }).click();
  await page.getByLabel("Tên khách", { exact: true }).fill("Khách thử");
  await page
    .getByRole("textbox", { name: "Số điện thoại (không bắt buộc)" })
    .fill("+84 90 000 4321");
  const form = page.getByRole("form", { name: "Thêm khách thủ công" });
  expect(
    (await new AxeBuilder({ page }).include(".manual-customer-form").analyze()).violations,
  ).toEqual([]);
  await form.screenshot({ path: info.outputPath("manual-customer-form.png"), scale: "css" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Lưu khách" }).click();
  await expect(page.getByText("Đã thêm khách vào danh bạ.")).toBeVisible();
  expect(request).toMatchObject({
    salonId: "salon-fixture",
    branchId: "branch-fixture",
    name: "Khách thử",
    phone: "0900004321",
    operationId: expect.any(String),
  });
});

test("search, disambiguate and confirm once on a real browser", async ({ page }, testInfo) => {
  const submissions: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__fixture/awardReturningCustomerPoints", (route) => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ json: { pointsAdded: 1, pointsAfter: 8, alreadyProcessed: false } });
  });
  await page.getByLabel("Tên khách hoặc 4 số cuối điện thoại").fill("5678");
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
  await page.route("**/__fixture/getLatestHaircutDetails", (route) =>
    route.fulfill({
      json: {
        recordId: "record-fixture",
        sessionId: "session-fixture",
        branchId: "branch-fixture",
        createdAtMs: 1234567890000,
        revision: 0,
        note: "",
        photoUrls: [],
        photoCount: 0,
        allowPhoto: true,
        photoConsentGranted: true,
      },
    }),
  );
  const detailWrites: Array<Record<string, unknown>> = [];
  await page.route("**/__fixture/updateLatestHaircutDetails", (route) => {
    detailWrites.push(route.request().postDataJSON());
    return route.fulfill({ json: { revision: 1 } });
  });
  await page.getByRole("button", { name: "Thêm ghi chú" }).click();
  await page.getByLabel("Ghi chú nội bộ").fill("Ghi chú thử nghiệm riêng của salon");
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();
  await expect(page.getByText(/Đã lưu ghi chú nội bộ/)).toBeVisible();
  expect(detailWrites).toHaveLength(1);
  expect(detailWrites[0]).toMatchObject({
    recordId: "record-fixture",
    revision: 0,
    note: "Ghi chú thử nghiệm riêng của salon",
  });
  expect(submissions).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("a lost response retries with the same operation ID", async ({ page }) => {
  const operations: string[] = [];
  await page.route("**/__fixture/awardReturningCustomerPoints", (route) => {
    operations.push(route.request().postDataJSON().operationId);
    return operations.length === 1
      ? route.fulfill({ status: 503, body: "fixture-unavailable" })
      : route.fulfill({ json: { pointsAdded: 1, pointsAfter: 5, alreadyProcessed: true } });
  });
  await page.getByLabel("Tên khách hoặc 4 số cuối điện thoại").fill("5678");
  await page.getByRole("button", { name: "Tìm khách" }).click();
  await page.getByRole("button", { name: /Chọn Minh An/ }).click();
  await page.getByRole("button", { name: "Xác nhận cộng 1 điểm" }).click();
  await expect(page.getByRole("alert")).toContainText("Kết nối bị gián đoạn");
  await page.getByRole("button", { name: "Xác nhận cộng 1 điểm" }).click();
  await expect(page.getByRole("status")).toContainText("Lượt này đã được ghi nhận");
  expect(operations).toHaveLength(2);
  expect(operations[0]).toBe(operations[1]);
});

test("staff can search a Vietnamese name on mobile and must verify the suffix", async ({
  page,
}) => {
  const lookup = page.getByLabel("Tên khách hoặc 4 số cuối điện thoại");
  await expect(lookup).toHaveAttribute("inputmode", "text");
  await lookup.fill("Quốc Bình");
  const pending = page.waitForRequest((request) => request.url().endsWith("/__fixture/search"));
  await page.getByRole("button", { name: "Tìm khách" }).click();
  expect((await pending).postDataJSON()).toMatchObject({ term: "Quốc Bình" });
  await page.getByRole("button", { name: /Chọn Quốc Bình/ }).click();
  const confirmation = page.getByRole("button", { name: "Xác nhận cộng 1 điểm" });
  const suffix = page.getByLabel("Xác nhận 4 số cuối điện thoại");
  await expect(confirmation).toBeDisabled();
  await suffix.fill("1234");
  await expect(confirmation).toBeDisabled();
  await suffix.fill("5678");
  await expect(confirmation).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
