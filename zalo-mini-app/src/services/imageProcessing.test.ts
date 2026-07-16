import { describe, expect, it } from "vitest";
import { validateSquareImageFile } from "./imageProcessing";

describe("validateSquareImageFile", () => {
  it("chấp nhận JPG, PNG và WebP dưới giới hạn", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const file = new File(["image"], `avatar.${type.split("/")[1]}`, { type });
      expect(validateSquareImageFile(file, { subject: "ảnh đại diện salon" })).toBe(file);
    }
  });

  it("từ chối định dạng và ảnh nguồn quá 10MB", () => {
    const invalid = new File(["text"], "avatar.svg", { type: "image/svg+xml" });
    expect(() => validateSquareImageFile(invalid, { subject: "ảnh đại diện salon" })).toThrow(
      "chỉ hỗ trợ ảnh JPG, PNG hoặc WebP",
    );

    const oversized = new File(["image"], "avatar.jpg", { type: "image/jpeg" });
    Object.defineProperty(oversized, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(() => validateSquareImageFile(oversized, { subject: "ảnh đại diện salon" })).toThrow(
      "dưới 10MB",
    );
  });
});
