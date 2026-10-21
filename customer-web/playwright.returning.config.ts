import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 60000,
  testDir: "./e2e",
  testMatch: "returning-customer-staff.browser.ts",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4175",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --config e2e/fixtures/returning.vite.config.ts --mode test",
    url: "http://127.0.0.1:4175/e2e/fixtures/returning-customer.html",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
