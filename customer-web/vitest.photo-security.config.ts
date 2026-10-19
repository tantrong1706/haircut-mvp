import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      "src/services/privatePhotoUrls.test.ts",
      "src/services/pointRequestPhotos.test.ts",
      "src/services/customerPhotos.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/services/privatePhotoUrls.ts", "src/services/pointRequestPhotos.ts"],
      reportsDirectory: "coverage/photo-security",
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
