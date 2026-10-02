import { describe, expect, it } from "vitest";
import { isOwnerAvatarDownloadUrl, isValidAuthEmail, passwordResetActionSettings } from "./auth";

describe("isValidAuthEmail", () => {
  it("chỉ chấp nhận email có định dạng hợp lệ", () => {
    expect(isValidAuthEmail("  owner@haircut.vn ")).toBe(true);
    expect(isValidAuthEmail("owner@haircut")).toBe(false);
    expect(isValidAuthEmail("owner haircut.vn")).toBe(false);
  });
});

describe("passwordResetActionSettings", () => {
  it("dùng Firebase mặc định ở local và quay lại đúng trang khi đã deploy", () => {
    expect(
      passwordResetActionSettings({
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:5175",
        pathname: "/owner",
      }),
    ).toBeUndefined();
    expect(
      passwordResetActionSettings({
        hostname: "haircut-c7d12.web.app",
        origin: "https://haircut-c7d12.web.app",
        pathname: "/staff",
      }),
    ).toEqual({
      url: "https://haircut-c7d12.web.app/staff",
      handleCodeInApp: false,
    });
  });
});

describe("isOwnerAvatarDownloadUrl", () => {
  const bucket = "haircut-test.appspot.com";
  const expectedPath = encodeURIComponent("salons/salon-a/owner_avatars/owner-a/avatar");

  it("chỉ nhận URL Firebase Storage đúng bucket và chủ salon", () => {
    expect(
      isOwnerAvatarDownloadUrl(
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${expectedPath}?alt=media`,
        bucket,
        "salon-a",
        "owner-a",
      ),
    ).toBe(true);
    expect(
      isOwnerAvatarDownloadUrl("https://example.com/avatar.jpg", bucket, "salon-a", "owner-a"),
    ).toBe(false);
  });
});
