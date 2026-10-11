import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const config = JSON.parse(readFileSync(new URL("../../firebase/firebase.json", import.meta.url), "utf8"));
const securityHeaders = Object.fromEntries(config.hosting.headers.find((rule: { source: string }) => rule.source === "**").headers.map((header: { key: string; value: string }) => [header.key.toLowerCase(), header.value]));

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...securityHeaders } });
  });
});

test("enforced baseline rejects external base URI and object embedding", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /Chính sách quyền riêng tư/i })).toBeVisible();
  await page.evaluate(() => {
    const root = window as typeof window & { cspViolations?: string[] };
    root.cspViolations = [];
    document.addEventListener("securitypolicyviolation", event => {
      if (event.disposition === "enforce") root.cspViolations?.push(event.effectiveDirective);
    });
    const base = document.createElement("base");
    base.href = "https://example.invalid/";
    document.head.append(base);
    const object = document.createElement("object");
    object.data = "/health.json";
    object.type = "application/pdf";
    document.body.append(object);
  });
  expect(await page.evaluate(() => document.baseURI)).toContain("127.0.0.1");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { cspViolations?: string[] }).cspViolations)).toEqual(expect.arrayContaining(["base-uri", "object-src"]));
});

test("baseline leaves Web OTP, session restore and account navigation usable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.name));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text().slice(0, 100)); });
  await page.addInitScript(() => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode = true;
  });
  const qr = "/checkin?qrType=branch&salonId=salon-csp-test&branchId=branch-csp&qrToken=signed-test-only";
  await page.goto(qr);
  await page.getByLabel("Số điện thoại").fill("0901234567");
  await page.getByRole("button", { name: "Gửi mã OTP" }).click();
  await page.getByLabel("Mã OTP").fill("123456");
  await page.getByRole("button", { name: "Xác nhận OTP" }).click();
  await page.getByRole("button", { name: "Yêu cầu tích điểm" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Điều hướng" })).toBeVisible();
  await expect(page.getByLabel("Số điện thoại")).toHaveCount(0);
  await page.getByRole("button", { name: "Lịch sử" }).last().click();
  await expect(page.getByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
  expect(errors).toEqual([]);
});
