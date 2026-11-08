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
        salonName: "Salon mẫu",
        salonHotline: "028 0000 0000",
        salonOpeningHours: "Thứ 2–CN, 09:00–20:00",
        branchAddress: "123 Nguyễn Huệ",
        branchDirectionsEnabled: true,
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
          hasCustomerPhotos: true,
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
  await expect(page.getByRole("link", { name: "028 0000 0000" })).toHaveAttribute("href", "tel:02800000000");
  await expect(page.getByText("Thứ 2–CN, 09:00–20:00")).toBeVisible();
  await expect(page.getByRole("link", { name: "Chỉ đường" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=123+Nguy%E1%BB%85n+Hu%E1%BB%87",
  );
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
  await expect(page.getByText("20/06/2026")).toBeVisible();
  await expect(page.getByLabel("Đã cộng 1 điểm")).toBeVisible();
  await expect(page.getByText("Fade thấp")).toHaveCount(0);
  await expect(page.locator(".history-page img")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Điểm" }).click();
  await page.getByRole("button", { name: /Quay ngay|Xem vòng quay/ }).click();
  await expect(page.getByRole("heading", { name: "Vòng quay may mắn" })).toBeVisible();

  await page.getByRole("button", { name: "Mã quà" }).click();
  await expect(page.getByRole("heading", { name: "Quà của tôi" })).toBeVisible();
});

test("khách mở và đóng ảnh của lượt cắt trong Lịch sử", async ({ page }) => {
  const photoUrl = "https://storage.googleapis.com/demo-haircut/photo.jpg?X-Goog-Signature=fixture";
  await page.addInitScript(({ salonId, url }) => {
    localStorage.setItem(`haircut_test_web_visit_photos:${salonId}`, JSON.stringify({ "record-e2e": [url] }));
  }, { salonId: qr.salonId, url: photoUrl });
  await page.route(photoUrl, (route) => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jPioAAAAASUVORK5CYII=", "base64"),
  }));
  await page.goto(`/?${new URLSearchParams(qr)}`);
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("img", { name: "Ảnh kiểu tóc 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Xem ảnh ngày 20/06/2026" }).click();
  const photo = page.getByRole("img", { name: "Ảnh kiểu tóc 1" });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(page.getByText("Fade thấp")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Ẩn ảnh ngày 20/06/2026" }).click();
  await expect(photo).toHaveCount(0);
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
  await expect(
    page.getByRole("heading", { level: 1, name: "Chính sách quyền riêng tư", exact: true }),
  ).toBeVisible();
});
