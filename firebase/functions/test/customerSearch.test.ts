import { describe, expect, it } from "vitest";
import { buildNameSearchPrefixes, normalizeSearchText } from "../src/customerSearch";

describe("customer search indexing", () => {
  it("chuẩn hóa dấu tiếng Việt và khoảng trắng", () => {
    expect(normalizeSearchText("  Hoàng   Phúc! ")).toBe("hoang phuc");
  });

  it("tạo tiền tố cho từng phần của tên", () => {
    const prefixes = buildNameSearchPrefixes("Anh Hoàng Phúc");

    expect(prefixes).toEqual(expect.arrayContaining(["anh", "hoang", "phuc", "anh h"]));
    expect(prefixes).not.toContain("p");
    expect(prefixes.length).toBeLessThanOrEqual(120);
  });
});
