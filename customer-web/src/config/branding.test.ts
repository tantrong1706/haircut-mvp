import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MINI_APP_NAME } from "./branding";

describe("Customer Web branding", () => {
  it("keeps the public brand consistent in HTML, PWA and legal pages", () => {
    const read = (name: string) => readFileSync(resolve(process.cwd(), name), "utf8");
    expect(MINI_APP_NAME).toBe("CH Haircut Salon");
    expect(JSON.parse(read("public/manifest.webmanifest")).name).toBe(MINI_APP_NAME);
    expect(read("index.html")).toContain(`<title>${MINI_APP_NAME}</title>`);
    for (const name of ["PrivacyPage", "TermsPage"]) {
      expect(read(`src/pages/${name}.tsx`)).toContain(MINI_APP_NAME);
      expect(read(`src/pages/${name}.tsx`)).not.toContain("CH Hair Studio");
    }
  });
});
