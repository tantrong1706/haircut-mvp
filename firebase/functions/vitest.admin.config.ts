import { defineConfig } from "vitest/config";

export default defineConfig({ test: {
  include: ["test/adminSupport.integration.test.ts"], fileParallelism: false, testTimeout: 20000,
  coverage: { provider: "v8", include: ["src/domains/admin/support.ts"], reporter: ["text", "json-summary"], thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 } },
} });
