import { describe, expect, it } from "vitest";
import {
  SALON_AVATAR_MAX_UPLOAD_SIZE,
  isExpectedSalonAvatarPath,
  isValidSalonAvatarMetadata,
  salonAvatarObjectPath,
} from "../src/domains/salons/branding";
import { storageObjectNameFromDownloadUrl } from "../src/customerPhotos";

describe("salon branding", () => {
  const salonId = "salon-a";
  const ownerUid = "owner-a";
  const bucketName = "haircut-c7d12.firebasestorage.app";
  const objectName = salonAvatarObjectPath(salonId);

  it("chỉ chấp nhận object avatar cố định của đúng salon", () => {
    expect(isExpectedSalonAvatarPath(objectName, salonId)).toBe(true);
    expect(isExpectedSalonAvatarPath("salons/salon-b/branding/avatar.webp", salonId)).toBe(false);
    expect(isExpectedSalonAvatarPath("salons/salon-a/branding/logo.webp", salonId)).toBe(false);
  });

  it("đọc URL Firebase đúng bucket và đúng object salon", () => {
    const url =
      `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
      `${encodeURIComponent(objectName)}?alt=media&token=download-token`;
    expect(storageObjectNameFromDownloadUrl(url, bucketName)).toBe(objectName);
    expect(storageObjectNameFromDownloadUrl(url, "other.firebasestorage.app")).toBeNull();
    expect(
      storageObjectNameFromDownloadUrl("https://example.com/logo.webp", bucketName),
    ).toBeNull();
  });

  it("kiểm tra MIME, kích thước và metadata owner", () => {
    const valid = {
      size: String(SALON_AVATAR_MAX_UPLOAD_SIZE),
      contentType: "image/webp",
      metadata: { salonId, ownerUid },
    };
    expect(isValidSalonAvatarMetadata(valid, { salonId, ownerUid })).toBe(true);
    expect(
      isValidSalonAvatarMetadata({ ...valid, contentType: "image/png" }, { salonId, ownerUid }),
    ).toBe(false);
    expect(
      isValidSalonAvatarMetadata(
        { ...valid, size: String(SALON_AVATAR_MAX_UPLOAD_SIZE + 1) },
        { salonId, ownerUid },
      ),
    ).toBe(false);
    expect(
      isValidSalonAvatarMetadata(
        { ...valid, metadata: { salonId, ownerUid: "owner-b" } },
        { salonId, ownerUid },
      ),
    ).toBe(false);
  });
});
