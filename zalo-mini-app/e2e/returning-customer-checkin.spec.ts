import { expect, test } from "@playwright/test";

test.use({ userAgent: "Zalo/24.0 MiniApp" });

test("khách cũ quét QR chi nhánh rồi yêu cầu điểm mà không nhập lại số điện thoại", async ({ page }) => {
  const branchQr = new URLSearchParams({
    qrType: "branch",
    salonId: "salon-e2e",
    branchId: "demo-branch-two",
    qrToken: "signed-branch-e2e",
    zaloPreview: "true",
  });

  await page.goto(`/?${branchQr}`);

  await expect(page.getByText("Đã lưu số kết thúc 8761")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Số điện thoại/ })).toHaveCount(0);

  const confirm = page.getByRole("button", { name: "Yêu cầu tích điểm" });
  await expect(page.getByRole("combobox", { name: "Chọn chi nhánh" })).toHaveCount(0);
  await expect(confirm).toBeEnabled();
  await expect(page.getByText("Chi nhánh Riverside").first()).toBeVisible();
  await confirm.click();

  await expect(page.getByRole("heading", { name: "Khách xem trước" })).toBeVisible();
});
