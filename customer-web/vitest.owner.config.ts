import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      "src/pages/OwnerPage.regression.test.tsx",
      "src/features/owner/OwnerPanels.test.tsx",
      "src/components/CustomerPointAction.test.tsx",
      "src/services/ownerStaffSession.test.ts",
      "src/services/ownerWorkspace.test.ts",
      "src/components/OwnerConfirmDialog.test.tsx",
      "src/pages/StaffPage.notes.test.tsx",
      "src/pages/AuthGate.test.tsx",
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/features/owner/OverviewPanel.tsx",
        "src/features/owner/ApprovalsPanel.tsx",
        "src/features/owner/WheelConfigPanel.tsx",
        "src/features/owner/ownerFormatters.ts",
        "src/features/owner/useOwnerNavigation.ts",
        "src/components/CustomerPointAction.tsx",
        "src/services/ownerStaffSession.ts",
        "src/services/ownerWorkspace.ts",
        "src/components/OwnerConfirmDialog.tsx",
      ],
      reportsDirectory: "coverage/owner-workspace",
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
