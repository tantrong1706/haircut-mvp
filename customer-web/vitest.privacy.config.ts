import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://app.chhaircutsalon.cc/" } },
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/services/privacyPreferences.test.ts",
      "src/services/monitoringConsent.test.ts",
      "src/services/customerPrivacy.test.ts",
      "src/components/PrivacyConsentControls.test.tsx",
      "src/components/CustomerPrivacyPanel.test.tsx",
      "src/components/PublicContact.test.tsx",
      "src/pages/LegalInfoPage.test.tsx",
      "src/pages/LegalContact.test.tsx",
      "src/pages/AccountDeletionPage.privacy.test.tsx",
    ],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/privacy",
      include: [
        "src/services/privacyPreferences.ts",
        "src/services/customerPrivacy.ts",
        "src/config/publicContact.ts",
        "src/components/PrivacyConsentControls.tsx",
        "src/components/CustomerPrivacyPanel.tsx",
        "src/components/PublicContact.tsx",
        "src/pages/LegalInfoPage.tsx",
      ],
      thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 },
    },
  },
});
