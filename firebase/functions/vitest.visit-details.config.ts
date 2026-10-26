import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/visitDetails.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/domains/photos/visitDetails.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/visit-details",
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
