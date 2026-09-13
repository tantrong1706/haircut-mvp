import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MINI_APP_NAME } from "./branding";

describe("branding Zalo Mini App", () => {
  it("đồng bộ tên chính thức trong source config, metadata và hồ sơ Version 24", () => {
    const appRoot = process.cwd();
    const repoRoot = resolve(appRoot, "..");
    const appConfig = JSON.parse(readFileSync(resolve(appRoot, "app-config.json"), "utf8")) as {
      app?: { title?: string; headerTitle?: string };
    };
    const manifest = JSON.parse(
      readFileSync(resolve(appRoot, "public", "manifest.webmanifest"), "utf8"),
    ) as { name?: string };
    const html = readFileSync(resolve(appRoot, "index.html"), "utf8");
    const privacy = readFileSync(resolve(appRoot, "src", "pages", "PrivacyPage.tsx"), "utf8");
    const terms = readFileSync(resolve(appRoot, "src", "pages", "TermsPage.tsx"), "utf8");
    const version24Submission = readFileSync(
      resolve(repoRoot, "docs", "ZALO_VERSION_24_SUBMISSION.md"),
      "utf8",
    );

    expect(MINI_APP_NAME).toBe("CH Haircut Salon");
    expect(appConfig.app?.title).toBe(MINI_APP_NAME);
    expect(appConfig.app?.headerTitle).toBe(MINI_APP_NAME);
    expect(manifest.name).toBe(MINI_APP_NAME);
    expect(html).toContain(`<title>${MINI_APP_NAME}</title>`);
    expect(privacy).toContain(MINI_APP_NAME);
    expect(terms).toContain(MINI_APP_NAME);
    expect([privacy, terms, version24Submission].join("\n")).not.toContain("CH Hair Studio");
    expect(version24Submission).toContain("Testing Version 24");
    expect(version24Submission).toContain("https://app.chhaircutsalon.cc/review-branch-v24.png");
    expect(version24Submission).toContain(
      "Chi nhánh chính — QR đề xuất: <https://app.chhaircutsalon.cc/review-branch-v24-chi-nhanh-chinh.png>",
    );
    expect(version24Submission).not.toMatch(/(?:qrToken|access_token|appsecret_proof)=/u);
  });
});
