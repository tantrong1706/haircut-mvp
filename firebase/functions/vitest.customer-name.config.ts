import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/customerName.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/domains/customers/customerName.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/customer-name",
      thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 },
    },
  },
});
