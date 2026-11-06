import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/webCustomerPrivacy.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/domains/privacy/customerPhotoConsent.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/privacy",
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
