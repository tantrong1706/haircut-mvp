import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-passkeys.browser.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4177",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --mode test --host localhost --port 4177 --strictPort",
    url: "http://localhost:4177",
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
