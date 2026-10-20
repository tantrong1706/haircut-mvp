import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto("/e2e/fixtures/owner-responsive.html");
  await expect(page.getByRole("heading", { name: "CH Hair Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeEnabled();
});

test("all owner menu items fit without horizontal scrolling", async ({ page }, info) => {
  await page.screenshot({ path: info.outputPath("owner-home.png"), fullPage: true });
  const menu = page.locator(".owner-tabs");
  await expect(menu.getByRole("button")).toHaveCount(8);
  expect(await menu.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  for (const button of await menu.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test("daily numbers have readable labels and quick actions precede retention", async ({ page }) => {
  const sizes = await page.locator(".overview-metric > span").evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
  expect(sizes).toHaveLength(7);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  const quick = await page.locator(".owner-next-actions").boundingBox();
  const retention = await page.locator(".retention-panel").boundingBox();
  expect(quick!.y).toBeLessThan(retention!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
