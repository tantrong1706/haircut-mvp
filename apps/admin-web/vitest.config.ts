import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/services/adminSupport.ts",
        "src/services/adminPresentation.ts",
        "src/components/SalonSupportPanel.tsx",
        "src/components/AdminDashboard.tsx",
        "src/components/AdminSections.tsx",
        "src/components/SalonDirectory.tsx",
        "src/components/SupportGuide.tsx",
      ],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
