import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const captureEnabled = process.env.HAIRCUT_CAPTURE_REVIEW_SCREENSHOTS === "1";
const localOrigin = "http://127.0.0.1:4173";
const outputDir = resolve(process.cwd(), "..", "docs", "zalo-review-screenshots.local");
const mobileViewport = { width: 390, height: 844 };
const manualOnlyScreenshots = ["06-zalo-permission.png"] as const;

test.describe("Bộ ảnh xét duyệt Zalo Version 8", () => {
  test.skip(!captureEnabled, "Chỉ chạy qua npm run capture:zalo-review");

  test.beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  test("tạo đúng bộ ảnh draft theo checklist hiện tại", async ({ browser }) => {
    test.info().annotations.push({
      type: "manual-only",
      description: manualOnlyScreenshots.join(", "),
    });

    const entryContext = await newContext(browser);
    const entryPage = await entryContext.newPage();

    await entryPage.goto(localOrigin);
    await expect(entryPage.getByRole("heading", { name: "Quét QR tại salon" })).toBeVisible();
    await capture(entryPage, "01-open.png");

    await entryPage.goto(
      `${localOrigin}/?${new URLSearchParams({
        qrType: "salon",
        salonId: "salon-preview",
        qrToken: "signed-salon-preview",
      })}`,
    );
    const branchSelector = entryPage.getByRole("combobox", { name: "Chọn chi nhánh" });
    await expect(branchSelector).toBeVisible();
    await capture(entryPage, "02-salon-qr.png");
    await branchSelector.scrollIntoViewIfNeeded();
    await capture(entryPage, "03-branch-selector.png");

    await entryPage.goto(
      `${localOrigin}/?${new URLSearchParams({
        qrType: "branch",
        salonId: "salon-preview",
        branchId: "demo-branch-main",
        qrToken: "signed-branch-preview",
      })}`,
    );
    await expect(entryPage.getByLabel("Tên hiển thị tại salon")).toHaveValue("Khách xem trước");
    await entryPage.evaluate(() => window.scrollTo(0, 0));
    await capture(entryPage, "04-branch.png");
    await capture(entryPage, "05-profile-explanation.png");
    const confirmCheckIn = entryPage.getByRole("button", { name: "Xác nhận vào hàng chờ" });
    await confirmCheckIn.scrollIntoViewIfNeeded();
    await capture(entryPage, "07-checkin.png");
    await entryContext.close();

    await captureCustomerState(browser, "waiting", "08-waiting.png");
    await captureCustomerState(browser, "serving", "09-serving.png");
    await captureCustomerState(browser, "completed", "10-points.png");

    const history = await customerPage(browser);
    await history.page.getByRole("button", { name: "Lịch sử" }).last().click();
    await expect(history.page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
    await capture(history.page, "11-history.png");
    await history.context.close();

    const wheel = await customerPage(browser);
    await wheel.page.getByRole("button", { name: "Vòng quay" }).last().click();
    await expect(wheel.page.getByRole("heading", { name: "Vòng quay may mắn" })).toBeVisible();
    await capture(wheel.page, "12-wheel-before.png");
    await wheel.context.close();

    await captureSpinResult(browser, 3, "13-wheel-result.png");

    const rewards = await customerPage(browser, {
      rewards: [
        {
          id: "reward-unused",
          rewardName: "Gội đầu miễn phí",
          rewardCode: "HC-REVIEW-CHUADUNG",
          status: "unused",
          createdAt: "14/07/2026",
          expiresAt: "14/08/2026",
        },
      ],
    });
    await rewards.page.getByRole("button", { name: "Quà" }).last().click();
    await expect(rewards.page.getByRole("heading", { name: "Quà của tôi" })).toBeVisible();
    await capture(rewards.page, "14-reward.png");
    await rewards.context.close();

    const legalContext = await newContext(browser);
    const legalPage = await legalContext.newPage();
    await legalPage.goto(`${localOrigin}/privacy`);
    await expect(
      legalPage.getByRole("heading", { name: "Chính sách quyền riêng tư" }),
    ).toBeVisible();
    await capture(legalPage, "15-privacy.png");
    await legalPage.goto(`${localOrigin}/terms`);
    await expect(legalPage.getByRole("heading", { name: "Điều khoản sử dụng" })).toBeVisible();
    await capture(legalPage, "16-terms.png");
    await legalContext.close();
  });
});

async function newContext(browser: Browser) {
  return browser.newContext({
    viewport: mobileViewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "vi-VN",
    reducedMotion: "reduce",
  });
}

async function customerPage(
  browser: Browser,
  options: {
    status?: CustomerStatus;
    rewards?: Array<Record<string, unknown>>;
    spinIndex?: number;
  } = {},
) {
  const context = await newContext(browser);
  const session = customerSession(options.status || "waiting");
  await context.addInitScript(
    ({ initialSession, identityBinding, rewards, spinIndex }) => {
      const savedAt = Date.now();
      localStorage.setItem(
        "haircut_customer_session_v2",
        JSON.stringify({
          schemaVersion: 2,
          salonId: initialSession.qr.salonId,
          sessionId: initialSession.sessionId,
          customerId: "mock-customer",
          identityBinding,
          savedAt,
          expiresAt: savedAt + 12 * 60 * 60 * 1000,
          qr: initialSession.qr,
        }),
      );
      localStorage.setItem("haircut_mock_points", String(initialSession.customer.points));
      localStorage.setItem("haircut_mock_session_status", initialSession.sessionStatus);
      localStorage.setItem("haircut_mock_rewards", JSON.stringify(rewards || []));
      if (typeof spinIndex === "number") {
        localStorage.setItem("haircut_mock_spin_index", String(spinIndex));
      }
    },
    {
      initialSession: session,
      identityBinding: previewIdentityBinding,
      rewards: options.rewards,
      spinIndex: options.spinIndex,
    },
  );
  const page = await context.newPage();
  await page.goto(
    `${localOrigin}/?${new URLSearchParams({
      qrType: "branch",
      salonId: "salon-e2e",
      branchId: "demo-branch-main",
      qrToken: "signed-branch-e2e",
    })}`,
  );
  await expect(page.getByRole("heading", { name: "Khách xem trước" })).toBeVisible();
  return { context, page };
}

async function captureCustomerState(browser: Browser, status: CustomerStatus, fileName: string) {
  const customer = await customerPage(browser, { status });
  await capture(customer.page, fileName);
  await customer.context.close();
}

async function captureSpinResult(browser: Browser, spinIndex: number, fileName: string) {
  const customer = await customerPage(browser, { spinIndex });
  await customer.page.getByRole("button", { name: "Vòng quay" }).last().click();
  await customer.page.getByRole("button", { name: "Quay ngay" }).click();
  await expect(customer.page.locator(".reward-result")).toBeVisible({ timeout: 10_000 });
  await customer.page.locator(".reward-result").scrollIntoViewIfNeeded();
  await capture(customer.page, fileName);
  await customer.context.close();
}

async function capture(page: Page, fileName: string) {
  await page.addStyleTag({
    content: `
      * { scrollbar-width: none !important; }
      *::-webkit-scrollbar { display: none !important; }
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      html, body, #root, #app, .app-shell { background-color: #f3f5f2 !important; }
      .bottom-nav { backdrop-filter: none !important; background-color: #ffffff !important; }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
      ),
    );
    await new Promise<void>((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
    );
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${fileName} không được tràn ngang`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: resolve(outputDir, fileName), fullPage: false });
}

function customerSession(status: CustomerStatus) {
  return {
    qr: {
      qrType: "branch",
      salonId: "salon-e2e",
      branchId: "demo-branch-main",
      mirrorId: "",
    },
    sessionId: `session-${status}`,
    branchName: "Chi nhánh Trung tâm",
    branchAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
    mirrorName: "Chi nhánh Trung tâm",
    zaloUserId: "zalo-e2e",
    sessionStatus: status,
    assignedStaffName: status === "waiting" ? "" : "Nhân viên Nam",
    claimedAtMs: status === "waiting" ? null : Date.now() - 10 * 60 * 1000,
    customer: {
      customerId: "customer-e2e",
      name: "Khách kiểm thử",
      phoneLast4: "8761",
      points: status === "completed" ? 10 : 9,
      allowPhoto: false,
    },
  };
}

type CustomerStatus = "waiting" | "serving" | "completed";

const previewIdentityBinding =
  "af6043a4c7f067471d233c0e7775b52b302f0acbcb68fe356b7be4a58dc9bbee";
