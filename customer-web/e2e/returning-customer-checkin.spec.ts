import { expect, test } from "@playwright/test";

test("khách cũ dùng phiên Firebase: QR quyết định chi nhánh, không nhập lại OTP", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
    localStorage.setItem("haircut_test_web_auth_uid", "web-test-uid");
  });
  await page.goto(
    "/checkin?qrType=branch&salonId=salon-e2e&branchId=demo-branch-two&qrToken=signed-branch-e2e",
  );
  await expect(page.getByRole("textbox", { name: /^Số điện thoại/ })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /Mã OTP/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Chọn chi nhánh" })).toHaveCount(0);
  await page.getByRole("button", { name: "Yêu cầu tích điểm" }).click();
  await expect(
    page.getByText("Đã gửi yêu cầu. Nhân viên chi nhánh sẽ xác nhận điểm."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("haircut_test_web_session:salon-e2e") || "{}").qr?.branchId,
    ),
  ).toBe("demo-branch-two");
});
