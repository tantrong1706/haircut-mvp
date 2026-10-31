import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/components/CustomerNameEditor.test.tsx", "src/services/customerName.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/components/CustomerNameEditor.tsx", "src/services/customerName.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/customer-name",
      thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 },
    },
  },
});
