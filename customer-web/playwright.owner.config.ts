import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "owner-responsive.browser.ts", workers: 1, retries: 0, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4176", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "phone-320", use: { ...devices["Pixel 7"], viewport: { width: 320, height: 740 } } },
    { name: "phone-360", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
    { name: "phone-webkit", use: { ...devices["iPhone 15"] } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: { command: "node node_modules/vite/bin/vite.js --config e2e/fixtures/owner.vite.config.ts --mode test", url: "http://127.0.0.1:4176/e2e/fixtures/owner-responsive.html", reuseExistingServer: false, timeout: 90000 },
});
