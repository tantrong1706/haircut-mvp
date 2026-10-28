import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    include: [
      "test/customerLogin.integration.test.ts",
      "test/customerSmsPolicy.test.ts",
      "test/customerPasskeyPolicy.test.ts",
      "test/customerWebIdentity.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domains/auth/*.ts"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
