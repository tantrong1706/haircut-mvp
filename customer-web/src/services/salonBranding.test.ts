import { describe, expect, it } from "vitest";
import { isSalonAvatarDownloadUrl, salonAvatarObjectPath } from "./salonBranding";

describe("salonBranding", () => {
  const bucketName = "haircut-c7d12.firebasestorage.app";
  const salonId = "salon-a";
  const validUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(salonAvatarObjectPath(salonId))}?alt=media&token=download-token`;

  it("chỉ chấp nhận Firebase URL đúng bucket và đúng salon", () => {
    expect(isSalonAvatarDownloadUrl(validUrl, bucketName, salonId)).toBe(true);
    expect(isSalonAvatarDownloadUrl(validUrl, bucketName, "salon-b")).toBe(false);
    expect(isSalonAvatarDownloadUrl(validUrl, "other.firebasestorage.app", salonId)).toBe(false);
    expect(isSalonAvatarDownloadUrl("https://example.com/avatar.webp", bucketName, salonId)).toBe(
      false,
    );
  });
});
