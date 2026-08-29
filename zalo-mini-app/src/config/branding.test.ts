import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MINI_APP_NAME } from "./branding";

describe("branding Zalo Mini App", () => {
  it("đồng bộ tên chính thức trong source config, metadata và hồ sơ Version 8", () => {
    const appRoot = process.cwd();
    const repoRoot = resolve(appRoot, "..");
    const appConfig = JSON.parse(readFileSync(resolve(appRoot, "app-config.json"), "utf8")) as {
      app?: { title?: string; headerTitle?: string };
    };
    const manifest = JSON.parse(
      readFileSync(resolve(appRoot, "public", "manifest.webmanifest"), "utf8"),
    ) as { name?: string };
    const html = readFileSync(resolve(appRoot, "index.html"), "utf8");
    const version8Submission = readFileSync(
      resolve(repoRoot, "docs", "ZALO_VERSION_8_SUBMISSION.md"),
      "utf8",
    );

    expect(MINI_APP_NAME).toBe("CH Hair Studio");
    expect(appConfig.app?.title).toBe(MINI_APP_NAME);
    expect(appConfig.app?.headerTitle).toBe(MINI_APP_NAME);
    expect(manifest.name).toBe(MINI_APP_NAME);
    expect(html).toContain(`<title>${MINI_APP_NAME}</title>`);
    expect(version8Submission).toContain(MINI_APP_NAME);
    expect(version8Submission.replace(/HAIRCUT Manager/g, "")).not.toMatch(/\bHAIRCUT\b/u);
  });
});
