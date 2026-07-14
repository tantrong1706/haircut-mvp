import { expect, test, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const captureEnabled = process.env.HAIRCUT_CAPTURE_REVIEW_SCREENSHOTS === "1";
const localOrigin = "http://127.0.0.1:4173";
const productionOrigin = "https://haircut-c7d12.web.app";
const outputDir = resolve(process.cwd(), "..", "docs", "zalo-review-screenshots.local");
const accountFile = resolve(process.cwd(), "..", "docs", "ZALO_REVIEW_ACCOUNTS.md.local");
const mobileViewport = { width: 390, height: 844 };
const desktopViewport = { width: 1365, height: 900 };

test.describe("Bộ ảnh xét duyệt Zalo", () => {
  test.skip(!captureEnabled, "Chỉ chạy qua npm run capture:zalo-review");

  test.beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });
  });

  test("ảnh khách trong build xem trước", async ({ browser }) => {
    const context = await newContext(browser, mobileViewport);
    const page = await context.newPage();

    await page.goto(
      `${localOrigin}/?${new URLSearchParams({
        qrType: "salon",
        salonId: "salon-preview",
        qrToken: "token-preview",
      })}`,
    );
    await expect(page.getByRole("combobox", { name: "Chọn chi nhánh" })).toBeVisible();
    await capture(page, "13-qr-salon-chon-chi-nhanh.png");

    await page.goto(
      `${localOrigin}/?${new URLSearchParams({
        qrType: "branch",
        salonId: "salon-preview",
        branchId: "demo-branch-main",
        qrToken: "token-preview",
      })}`,
    );
    await expect(page.getByLabel("Tên hiển thị tại salon")).toHaveValue("Khách xem trước");
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, "14-qr-chi-nhanh-xac-nhan-khach.png");
    const confirmCheckIn = page.getByRole("button", { name: "Xác nhận vào hàng chờ" });
    await confirmCheckIn.evaluate((element) =>
      element.scrollIntoView({ block: "end", behavior: "instant" }),
    );
    await capture(page, "14b-khach-xac-nhan-tao-luot.png");

    await context.close();

    await captureCustomerState(browser, "waiting", "09-khach-trang-chu.png");
    await captureCustomerState(browser, "serving", "15-khach-dang-phuc-vu.png");
    await captureCustomerState(browser, "completed", "16-khach-hoan-tat-cong-diem.png");

    const history = await customerPage(browser);
    await history.page.getByRole("button", { name: "Lịch sử" }).last().click();
    await expect(history.page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
    await capture(history.page, "10-khach-lich-su.png");
    await history.context.close();

    const wheel = await customerPage(browser);
    await wheel.page.getByRole("button", { name: "Vòng quay" }).last().click();
    await expect(wheel.page.getByRole("heading", { name: "Vòng quay may mắn" })).toBeVisible();
    await capture(wheel.page, "11-khach-vong-quay.png");
    await wheel.context.close();

    await captureSpinResult(browser, 3, "17-vong-quay-trung-qua.png");
    await captureSpinResult(browser, 4, "18-vong-quay-khong-trung.png");

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
        {
          id: "reward-used",
          rewardName: "Giảm 10% dịch vụ",
          rewardCode: "HC-REVIEW-DADUNG",
          status: "used",
          createdAt: "10/07/2026",
          expiresAt: "",
        },
      ],
    });
    await rewards.page.getByRole("button", { name: "Quà" }).last().click();
    await expect(rewards.page.getByRole("heading", { name: "Quà của tôi" })).toBeVisible();
    await capture(rewards.page, "12-khach-co-ma-qua.png");
    await rewards.context.close();
  });

  test("ảnh owner có dữ liệu vận hành", async ({ browser }) => {
    test.skip(!existsSync(accountFile), "Thiếu tài khoản xét duyệt local");
    const credentials = readAccount("Chủ salon");

    const loginContext = await newContext(browser, mobileViewport);
    const loginPage = await loginContext.newPage();
    await loginPage.goto(`${productionOrigin}/owner`);
    await expect(loginPage.getByRole("heading", { name: "Đăng nhập quản lý" })).toBeVisible();
    await capture(loginPage, "01-dang-nhap-quan-ly-mobile.png");
    await loginContext.close();

    const context = await newContext(browser, desktopViewport);
    const page = await context.newPage();
    await login(page, "/owner", credentials);
    await expect(page.getByRole("button", { name: "Tổng" })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, "02a-chu-salon-thong-tin.png");

    await page.getByRole("heading", { name: "Tổng quan" }).scrollIntoViewIfNeeded();
    await capture(page, "02-chu-salon-tong-quan.png");

    await page.getByRole("button", { name: "Duyệt" }).first().click();
    const approval = page.locator(".approval-card").first();
    await expect(approval).toBeVisible();
    await approval.getByRole("button", { name: "Duyệt" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(page, "03-chu-salon-xac-nhan-duyet-diem.png");
    await page.getByRole("button", { name: "Hủy" }).click();

    await page.getByRole("button", { name: "Chi nhánh" }).click();
    await page.getByRole("heading", { name: "Chi nhánh và QR" }).scrollIntoViewIfNeeded();
    await capture(page, "04-chu-salon-chi-nhanh-va-qr.png");

    await page.getByRole("button", { name: "Nhân viên" }).click();
    await page.getByRole("heading", { name: "Quản lý nhân viên" }).scrollIntoViewIfNeeded();
    await capture(page, "05-chu-salon-quan-ly-nhan-vien.png");
    await context.close();
  });

  test("ảnh staff và chính sách", async ({ browser }) => {
    test.skip(!existsSync(accountFile), "Thiếu tài khoản xét duyệt local");
    const credentials = readAccount("Nhân viên");

    const mobileContext = await newContext(browser, mobileViewport);
    const mobilePage = await mobileContext.newPage();
    await login(mobilePage, "/staff", credentials);
    await expect(mobilePage.getByRole("heading", { name: "Khách đang chờ" })).toBeVisible();
    const mobileWaitingCustomer = mobilePage.getByRole("button", { name: /Anh Hoàng/ });
    await expect(mobileWaitingCustomer).toBeVisible();
    await mobileWaitingCustomer.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await capture(mobilePage, "06-nhan-vien-hang-cho-mobile.png");
    await mobileContext.close();

    const context = await newContext(browser, desktopViewport);
    const page = await context.newPage();
    await login(page, "/staff", credentials);
    await page.getByRole("button", { name: /Anh Hoàng/ }).click();
    const claimCustomer = page.getByRole("button", { name: "Nhận khách" });
    await expect(claimCustomer).toBeVisible();
    await claimCustomer.evaluate((element) =>
      element.scrollIntoView({ block: "end", behavior: "instant" }),
    );
    await capture(page, "07a-nhan-vien-nhan-khach.png");

    await page.getByRole("button", { name: /Linh Chi/ }).click();
    await page
      .getByPlaceholder("Ví dụ: Fade thấp, giữ mái, không cắt quá cao")
      .fill("Fade thấp, tỉa gọn hai bên, giữ độ dài phần mái");
    const submitPointRequest = page.getByRole("button", { name: /Gửi cộng 1 điểm/ });
    await expect(submitPointRequest).toBeEnabled();
    await submitPointRequest.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 80));
    await capture(page, "07b-nhan-vien-ghi-chu-gui-diem.png");
    await context.close();

    const privacyContext = await newContext(browser, mobileViewport);
    const privacyPage = await privacyContext.newPage();
    await privacyPage.goto(`${localOrigin}/privacy`);
    await expect(
      privacyPage.getByRole("heading", { name: "Chính sách quyền riêng tư" }),
    ).toBeVisible();
    await capture(privacyPage, "08-chinh-sach-quyen-rieng-tu-mobile.png");
    await privacyPage.getByRole("heading", { name: "9. Liên hệ" }).scrollIntoViewIfNeeded();
    await capture(privacyPage, "08b-chinh-sach-lien-he-ho-tro-mobile.png");
    await privacyContext.close();
  });
});

async function newContext(browser: Browser, viewport: { width: number; height: number }) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "vi-VN",
    reducedMotion: "reduce",
  });
}

async function login(page: Page, path: string, credentials: Credentials) {
  await page.goto(`${productionOrigin}${path}`);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(credentials.password);
  await page.locator("form").getByRole("button", { name: "Đăng nhập" }).click();
}

async function customerPage(
  browser: Browser,
  options: {
    status?: CustomerStatus;
    rewards?: Array<Record<string, unknown>>;
    spinIndex?: number;
  } = {},
) {
  const context = await newContext(browser, mobileViewport);
  const session = customerSession(options.status || "waiting");
  await context.addInitScript(
    ({ initialSession, rewards, spinIndex }) => {
      localStorage.setItem("haircut_app_session_v1", JSON.stringify(initialSession));
      localStorage.setItem("haircut_mock_points", String(initialSession.customer.points));
      localStorage.setItem("haircut_mock_rewards", JSON.stringify(rewards || []));
      if (typeof spinIndex === "number") {
        localStorage.setItem("haircut_mock_spin_index", String(spinIndex));
      }
    },
    { initialSession: session, rewards: options.rewards, spinIndex: options.spinIndex },
  );
  const page = await context.newPage();
  await page.goto(
    `${localOrigin}/?${new URLSearchParams({
      qrType: "branch",
      salonId: "salon-e2e",
      branchId: "demo-branch-main",
      qrToken: "token-e2e",
    })}`,
  );
  await expect(page.getByRole("heading", { name: "Khách kiểm thử" })).toBeVisible();
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
  await customer.page
    .locator(".reward-result")
    .evaluate((element) => element.scrollIntoView({ block: "end", behavior: "instant" }));
  await customer.page.evaluate(() => window.scrollBy(0, 110));
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
      html, body, #root, .app-shell {
        background-color: #f3f5f2 !important;
      }
      .bottom-nav, .owner-tabs {
        backdrop-filter: none !important;
        background-color: #ffffff !important;
      }
      .bottom-nav {
        left: 12px !important;
        right: 12px !important;
        width: auto !important;
        transform: none !important;
      }
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
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${fileName} không được tràn ngang`).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: resolve(outputDir, fileName),
    fullPage: false,
  });
}

function readAccount(heading: string): Credentials {
  const content = readFileSync(accountFile, "utf8");
  const section = content.split(`## ${heading}`)[1]?.split("\n## ")[0] || "";
  const email = section.match(/^- Email:\s*(.+)$/m)?.[1]?.trim() || "";
  const password = section.match(/^- Mật khẩu:\s*(.+)$/m)?.[1]?.trim() || "";
  if (!email || !password) {
    throw new Error(`Thiếu tài khoản local cho ${heading}.`);
  }
  return { email, password };
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

type Credentials = { email: string; password: string };
type CustomerStatus = "waiting" | "serving" | "completed";
