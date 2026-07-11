import { describe, expect, it } from "vitest";
import { buildNameSearchPrefixes, normalizeSearchText } from "../src/customerSearch";

describe("customer search indexing", () => {
  it("chuẩn hóa dấu tiếng Việt và khoảng trắng", () => {
    expect(normalizeSearchText("  Tấn   Trọng! ")).toBe("tan trong");
  });

  it("tạo tiền tố cho từng phần của tên", () => {
    const prefixes = buildNameSearchPrefixes("Anh Tấn Trọng");

    expect(prefixes).toEqual(expect.arrayContaining(["anh", "tan", "trong", "anh t"]));
    expect(prefixes).not.toContain("t");
    expect(prefixes.length).toBeLessThanOrEqual(120);
  });
});
