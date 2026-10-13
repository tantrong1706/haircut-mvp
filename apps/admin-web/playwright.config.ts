import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs", fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  use: { baseURL: "http://127.0.0.1:4175", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
  webServer: { command: "npm run preview:e2e", url: "http://127.0.0.1:4175", reuseExistingServer: false, timeout: 60000 },
});
