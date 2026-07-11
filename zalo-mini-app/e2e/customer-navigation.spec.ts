import { expect, test } from "@playwright/test";

const qr = {
  salonId: "salon-e2e",
  mirrorId: "Gương 1",
  qrToken: "token-e2e",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (session) => {
      localStorage.setItem("haircut_app_session_v1", JSON.stringify(session));
    },
    {
      qr,
      sessionId: "session-e2e",
      zaloUserId: "zalo-e2e",
      sessionStatus: "waiting",
      customer: {
        customerId: "customer-e2e",
        name: "Khách kiểm thử",
        phoneLast4: "6789",
        points: 7,
        allowPhoto: false,
      },
    },
  );
});

test("khách chuyển qua điểm, lịch sử, vòng quay và quà", async ({ page }) => {
  await page.goto(`/?${new URLSearchParams(qr)}`);

  await expect(page.getByRole("heading", { name: "Khách kiểm thử" })).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();

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

test("trang quyền riêng tư mở độc lập", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Quyền riêng tư/i })).toBeVisible();
});
