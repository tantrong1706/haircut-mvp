import { expect, test } from "@playwright/test";

const qr = {
  qrType: "branch",
  salonId: "salon-e2e",
  branchId: "branch-e2e",
  qrToken: "signed-e2e",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((sessionQr) => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
    localStorage.setItem("haircut_test_web_auth_uid", "web-test-uid");
    localStorage.setItem(
      `haircut_test_web_session:${sessionQr.salonId}`,
      JSON.stringify({
        identityProvider: "firebase",
        firebaseUid: "web-test-uid",
        sessionId: "session-e2e",
        zaloUserId: "",
        sessionStatus: "completed",
        customer: {
          customerId: "web-test-salon-e2e",
          name: "Khách Web",
          phoneLast4: "4567",
          points: 7,
          allowPhoto: true,
        },
        qr: {
          qrType: sessionQr.qrType,
          salonId: sessionQr.salonId,
          branchId: sessionQr.branchId,
          mirrorId: "",
        },
      }),
    );
    localStorage.setItem(`haircut_test_web_points:${sessionQr.salonId}`, "7");
    localStorage.setItem(
      `haircut_test_web_history:${sessionQr.salonId}`,
      JSON.stringify([
        {
          id: "record-e2e",
          createdAt: "20/06/2026",
          staffName: "Nam",
          note: "Fade thấp",
          photoUrls: [],
          pointsAdded: 1,
        },
      ]),
    );
    localStorage.setItem(
      `haircut_test_web_spin:${sessionQr.salonId}`,
      JSON.stringify({
        rewardId: "reward-e2e",
        rewardName: "Gội đầu miễn phí",
        rewardCode: "TEST-ONLY",
        pointsAfter: 2,
        isWinning: true,
        selectedIndex: 1,
        selectedSlotId: "slot-2",
        configVersion: 1,
      }),
    );
  }, qr);
});

test("khách chuyển qua điểm, lịch sử, vòng quay và quà", async ({ page }) => {
  await page.goto(`/?${new URLSearchParams(qr)}`);

  await expect(page.getByRole("heading", { name: "Khách Web" })).toBeVisible();
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
  await page.getByRole("button", { name: /20\/06\/2026/ }).click();
  await expect(page.getByRole("dialog", { name: "Chi tiết lần cắt" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Không có ảnh")).toBeVisible();
  await page.getByRole("button", { name: "Đóng chi tiết" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Điểm" }).click();
  await page.getByRole("button", { name: /Quay ngay|Xem vòng quay/ }).click();
  await expect(page.getByRole("heading", { name: "Vòng quay may mắn" })).toBeVisible();

  await page.getByRole("button", { name: "Mã quà" }).click();
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
  await page.getByRole("button", { name: /Quay ngay|Xem vòng quay/ }).click();
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
