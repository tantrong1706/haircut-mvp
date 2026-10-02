import { expect, test } from "@playwright/test";

test("owner mở đúng cổng đăng nhập và đăng ký salon", async ({ page }) => {
  await page.goto("/owner");

  await expect(page.getByRole("heading", { name: "Đăng nhập quản lý" })).toBeVisible();
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByRole("heading", { name: "Khôi phục mật khẩu" })).toBeVisible();
  await page.getByLabel("Email").fill("owner@haircut.vn");
  await expect(page.getByRole("button", { name: "Gửi email đặt lại mật khẩu" })).toBeEnabled();
  await page.getByRole("button", { name: "Quay lại đăng nhập" }).click();

  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page.getByRole("heading", { name: "Đăng ký salon mới" })).toBeVisible();
});

test("staff mở đúng cổng đăng nhập quản lý", async ({ page }) => {
  await page.goto("/staff");

  await expect(page.getByRole("heading", { name: "Đăng nhập quản lý" })).toBeVisible();
  await expect(page.getByText(/email được chủ salon mời/i)).toBeVisible();
});
