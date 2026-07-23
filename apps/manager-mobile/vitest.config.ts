import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { managerDependencyAliases } from "./dependencyAliases";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: managerDependencyAliases,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
