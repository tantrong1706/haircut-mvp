import { expect, test } from "@playwright/test";

const qrA =
  "/checkin?qrType=branch&salonId=salon-web-a&branchId=demo-branch-main&qrToken=signed-web-a";
const qrB =
  "/checkin?qrType=branch&salonId=salon-web-b&branchId=demo-branch-main&qrToken=signed-web-b";

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

test("thiết bị mới: QR web -> Phone OTP -> check-in", async ({ page }) => {
  await page.goto(qrA);
  await expect(page.getByLabel("Số điện thoại")).toBeVisible();
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await expect(page.getByRole("button", { name: "Check-in" })).toBeVisible();
  await page.getByRole("button", { name: "Check-in" }).click();
  await expect(page.getByText("Salon đã nhận khách.")).toBeVisible();
  await expect(page.getByText("0", { exact: true })).toBeVisible();
  const navButtons = page.getByRole("navigation", { name: "Điều hướng" }).getByRole("button");
  await expect(navButtons).toHaveCount(4);
  const navTopEdges = await navButtons.evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
  );
  expect(new Set(navTopEdges).size).toBe(1);
});

test("thiết bị quay lại: Firebase session restore và không hiện OTP", async ({ page }) => {
  await completeTestPhoneLogin(page, qrA);
  await page.goto(qrA);

  await expect(page.getByLabel("Số điện thoại")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check-in" })).toBeVisible();
});

test("cùng UID sang salon thứ hai không OTP và có profile tenant riêng", async ({ page }) => {
  await completeTestPhoneLogin(page, qrA);
  await page.getByRole("button", { name: "Check-in" }).click();
  await expect(page.getByText("Salon đã nhận khách.")).toBeVisible();

  await page.goto(qrB);
  await expect(page.getByLabel("Số điện thoại")).toHaveCount(0);
  await expect(page.getByText("0 điểm")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check-in" })).toBeVisible();
});

test("đăng xuất customer chỉ làm thiết bị yêu cầu OTP lại", async ({ page }) => {
  await completeTestPhoneLogin(page, qrA);
  await page.getByRole("button", { name: "Check-in" }).click();
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("button", { name: "Đăng xuất khỏi thiết bị này" }).click();

  await expect(page.getByLabel("Số điện thoại")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi mã OTP" })).toBeEnabled();
});

async function completeTestPhoneLogin(page: import("@playwright/test").Page, url: string) {
  await page.goto(url);
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await expect(page.getByRole("button", { name: "Check-in" })).toBeVisible();
}
