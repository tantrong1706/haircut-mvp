import { describe, expect, it } from "vitest";
import {
  isExpectedHaircutPhotoPath,
  storageObjectNameFromDownloadUrl,
} from "../src/customerPhotos";

describe("customer photo validation", () => {
  const bucketName = "haircut-c7d12.firebasestorage.app";
  const objectName =
    "salons/salon-a/customers/customer-a/haircuts/session-a/photo-123456789abc.jpg";
  const downloadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(objectName)}?alt=media&token=secret-token`;

  it("đọc đúng đường dẫn từ Firebase download URL thuộc bucket hiện tại", () => {
    expect(storageObjectNameFromDownloadUrl(downloadUrl, bucketName)).toBe(objectName);
  });

  it("từ chối URL ngoài Firebase hoặc thuộc bucket khác", () => {
    expect(
      storageObjectNameFromDownloadUrl("https://example.com/photo.jpg", bucketName),
    ).toBeNull();
    expect(storageObjectNameFromDownloadUrl(downloadUrl, "other.firebasestorage.app")).toBeNull();
  });

  it("chỉ chấp nhận ảnh nằm trong đúng salon, khách và lượt cắt", () => {
    expect(
      isExpectedHaircutPhotoPath(objectName, {
        salonId: "salon-a",
        customerId: "customer-a",
        sessionId: "session-a",
      }),
    ).toBe(true);
    expect(
      isExpectedHaircutPhotoPath(objectName, {
        salonId: "salon-a",
        customerId: "customer-b",
        sessionId: "session-a",
      }),
    ).toBe(false);
  });
});
