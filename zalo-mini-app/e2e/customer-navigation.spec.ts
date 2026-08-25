import { expect, test } from "@playwright/test";

const qr = {
  qrType: "branch",
  salonId: "salon-e2e",
  branchId: "branch-e2e",
  qrToken: "signed-e2e",
};

const previewIdentityBinding = "af6043a4c7f067471d233c0e7775b52b302f0acbcb68fe356b7be4a58dc9bbee";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ identityBinding, sessionQr }) => {
      const savedAt = Date.now();
      localStorage.setItem(
        "haircut_customer_session_v2",
        JSON.stringify({
          schemaVersion: 2,
          salonId: sessionQr.salonId,
          sessionId: "session-e2e",
          customerId: "mock-customer",
          identityBinding,
          savedAt,
          expiresAt: savedAt + 12 * 60 * 60 * 1000,
          qr: {
            qrType: sessionQr.qrType,
            salonId: sessionQr.salonId,
            branchId: sessionQr.branchId,
            mirrorId: "",
          },
        }),
      );
      localStorage.setItem("haircut_mock_points", "7");
    },
    { identityBinding: previewIdentityBinding, sessionQr: qr },
  );
});

test("khách chuyển qua điểm, lịch sử, vòng quay và quà", async ({ page }) => {
  await page.goto(`/?${new URLSearchParams(qr)}`);

  await expect(page.getByRole("heading", { name: "Khách xem trước" })).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
  await page.getByRole("button", { name: /20\/06\/2026/ }).click();
  await expect(page.getByRole("dialog", { name: "Chi tiết lần cắt" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Không có ảnh")).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Vòng quay" }).last().click();
  await expect(page.getByRole("heading", { name: "Vòng quay may mắn" })).toBeVisible();

  await page.getByRole("button", { name: "Quà" }).last().click();
  await expect(page.getByRole("heading", { name: "Quà của tôi" })).toBeVisible();
});

test("giao diện mobile không tràn ngang", async ({ page }) => {
  await page.goto(`/?${new URLSearchParams(qr)}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("vòng quay chạy đủ timeline và dừng giữa ô backend chọn", async ({ page }) => {
  await page.goto(`/?${new URLSearchParams(qr)}`);
  await page.getByRole("button", { name: "Vòng quay" }).last().click();
  await page.getByRole("button", { name: "Quay ngay" }).click();

  const wheel = page.getByTestId("lucky-wheel");
  await expect(wheel).toHaveClass(/animating/);
  await expect(page.getByRole("button", { name: "Đang quay..." })).toBeDisabled();
  expect(await wheel.evaluate((element) => getComputedStyle(element).animationDuration)).toBe(
    "6.5s",
  );

  await expect(page.locator(".reward-result")).toBeVisible({ timeout: 10_000 });
  const finalRotation = Number(await wheel.getAttribute("data-rotation"));
  const normalizedCenter = (((90 + finalRotation) % 360) + 360) % 360;
  expect(normalizedCenter).toBeCloseTo(0, 8);
});

test("trang quyền riêng tư mở độc lập", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Quyền riêng tư/i })).toBeVisible();
});
