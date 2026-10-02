import { expect, test } from "@playwright/test";

test("App Check support page is isolated and never runs automatically", async ({ page }) => {
  const remoteCalls: string[] = [];
  page.on("request", (request) => {
    if (/firebaseappcheck\.googleapis\.com|cloudfunctions\.net/.test(request.url())) {
      remoteCalls.push("unexpected");
    }
  });
  await page.goto("/app-check");
  await expect(page.getByRole("heading", { name: "Kiểm tra bảo vệ" })).toBeVisible();
  await expect(page.getByLabel("Số điện thoại")).toHaveCount(0);
  expect(remoteCalls).toEqual([]);
  await page.getByRole("button", { name: "Kiểm tra ngay" }).click();
  await expect(page.getByText("Chưa xác minh được trình duyệt")).toBeVisible();
  await expect(page.getByText(/NOT_CONFIGURED/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Kiểm tra ngay" })).toBeDisabled();
  expect(remoteCalls).toEqual([]);
});
