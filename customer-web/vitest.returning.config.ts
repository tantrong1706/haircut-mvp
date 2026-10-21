import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    include: [
      "src/components/ReturningCustomerPoints.test.tsx",
      "src/services/returningCustomerPoints.test.ts",
    ],
    coverage: {
      include: [
        "src/components/ReturningCustomerPoints.tsx",
        "src/services/returningCustomerPoints.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
