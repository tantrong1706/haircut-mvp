import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      "src/components/SalonVisitDetails.test.tsx",
      "src/components/SalonHaircutHistory.test.tsx",
    ],
    coverage: {
      provider: "v8",
      include: ["src/components/SalonVisitDetails.tsx", "src/components/SalonHaircutHistory.tsx"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/visit-details",
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
