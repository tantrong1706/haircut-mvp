import { expect, test } from "@playwright/test";

test.use({ userAgent: "Zalo/24.0 MiniApp" });

test("khách cũ chọn chi nhánh rồi xác nhận mà không nhập lại số điện thoại", async ({ page }) => {
  const salonQr = new URLSearchParams({
    qrType: "salon",
    salonId: "salon-e2e",
    qrToken: "signed-salon-e2e",
    zaloPreview: "true",
  });

  await page.goto(`/?${salonQr}`);

  await expect(page.getByText("Đã lưu số kết thúc 8761")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Số điện thoại/ })).toHaveCount(0);

  const branch = page.getByRole("combobox", { name: "Chọn chi nhánh" });
  const confirm = page.getByRole("button", { name: "Xác nhận vào hàng chờ" });
  await expect(branch).toHaveValue("");
  await expect(confirm).toBeDisabled();

  await branch.selectOption("demo-branch-two");
  await expect(confirm).toBeEnabled();
  await expect(page.getByText("Chi nhánh Riverside").first()).toBeVisible();
  await confirm.click();

  await expect(page.getByRole("heading", { name: "Khách xem trước" })).toBeVisible();
});
