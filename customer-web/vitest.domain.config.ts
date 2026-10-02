import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/services/{wheel,safeStorage}.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      allowExternal: true,
      include: ["**/packages/client-domain/*.ts"],
      reportsDirectory: "coverage/domain",
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
