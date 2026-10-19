import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "test/privatePhotoAccess.integration.test.ts",
      "test/privatePhotoUrl.test.ts",
      "test/photoDownloadTokens.test.ts",
      "test/photoUploadOperations.test.ts",
    ],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: [
        "src/domains/photos/{privatePhotoAccess,photoDownloadTokens,photoUploadOperations}.ts",
      ],
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/photo-security",
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
