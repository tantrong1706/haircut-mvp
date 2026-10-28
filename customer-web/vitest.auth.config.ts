import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    include: [
      "src/services/customerWebAuth.test.ts",
      "src/services/customerPasskeys.test.ts",
      "src/components/CustomerPasskeys.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/services/customerWebAuth.ts",
        "src/services/customerPasskeys.ts",
        "src/components/CustomerPasskeys.tsx",
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
