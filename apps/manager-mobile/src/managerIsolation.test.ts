import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".css"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("Manager source boundary", () => {
  it("không import page hoặc CSS toàn cục của Zalo Mini App", () => {
    const forbidden = /zalo-mini-app\/src\/(pages|styles)/;
    const violations = sourceFiles(sourceRoot)
      .map((path) => ({ path, content: readFileSync(path, "utf8").split("\\").join("/") }))
      .filter(({ content }) => forbidden.test(content))
      .map(({ path }) => path);

    expect(violations).toEqual([]);
  });

  it("entry point chỉ nạp stylesheet thuộc Manager", () => {
    const main = readFileSync(join(sourceRoot, "main.tsx"), "utf8");
    expect(main).toContain('import "./manager.css"');
    expect(main).not.toContain("zalo-mini-app");
  });
});
