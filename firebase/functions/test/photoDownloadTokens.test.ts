import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_PHOTO_CACHE_CONTROL,
  isPrivateHaircutObject,
  revokeHaircutDownloadTokens,
} from "../src/domains/photos/photoDownloadTokens";

const name = `salons/salon-a/customers/customer-a/sessions/session-a/op-${"a".repeat(40)}.jpg`;
const fixture = () => ({
  name,
  getMetadata: vi.fn().mockResolvedValue([
    {
      metageneration: "2",
      metadata: { firebaseStorageDownloadTokens: "test-only", checksum: "keep-me" },
    },
  ]),
  setMetadata: vi.fn().mockResolvedValue([]),
});
describe("private photo token revocation", () => {
  it("changes only the token and cache fields with a metadata precondition", async () => {
    const file = fixture();
    expect(await revokeHaircutDownloadTokens(file as never)).toBe(true);
    expect(file.setMetadata).toHaveBeenCalledWith(
      {
        cacheControl: PRIVATE_PHOTO_CACHE_CONTROL,
        metadata: { firebaseStorageDownloadTokens: null },
      },
      { ifMetagenerationMatch: "2" },
    );
  });
  it("does nothing when already private and tokenless", async () => {
    const file = fixture();
    file.getMetadata.mockResolvedValue([
      { cacheControl: PRIVATE_PHOTO_CACHE_CONTROL, metageneration: "3", metadata: {} },
    ]);
    expect(await revokeHaircutDownloadTokens(file as never)).toBe(false);
    expect(file.setMetadata).not.toHaveBeenCalled();
  });
  it("bounds precondition retries and re-reads current metadata", async () => {
    const file = fixture();
    file.setMetadata.mockRejectedValueOnce({ code: 412 });
    expect(await revokeHaircutDownloadTokens(file as never)).toBe(true);
    expect(file.getMetadata).toHaveBeenCalledTimes(2);
    file.setMetadata.mockRejectedValue({ code: 412 });
    await expect(revokeHaircutDownloadTokens(file as never)).rejects.toMatchObject({ code: 412 });
    expect(file.getMetadata).toHaveBeenCalledTimes(5);
  });
  it("handles deleted objects without recreating them", async () => {
    const file = fixture();
    file.getMetadata.mockRejectedValue({ code: 404 });
    expect(await revokeHaircutDownloadTokens(file as never)).toBe(false);
    expect(file.setMetadata).not.toHaveBeenCalled();
  });
  it("never touches avatars, arbitrary paths or an object without metadata version", async () => {
    expect(isPrivateHaircutObject(name)).toBe(true);
    expect(isPrivateHaircutObject("salons/a/customers/b/haircuts/c/photo-123456789abc.jpg")).toBe(
      true,
    );
    for (const value of [
      "salons/a/branding/avatar.webp",
      "salons/a/customers/b/sessions/c/avatar.jpg",
      "../photo.jpg",
      name + "/extra",
    ]) {
      const file = { ...fixture(), name: value };
      await expect(revokeHaircutDownloadTokens(file as never)).rejects.toThrow("Not a scoped");
      expect(file.getMetadata).not.toHaveBeenCalled();
    }
    const file = fixture();
    file.getMetadata.mockResolvedValue([
      { metadata: { firebaseStorageDownloadTokens: "test-only" } },
    ]);
    await expect(revokeHaircutDownloadTokens(file as never)).rejects.toThrow("metadata version");
    expect(file.setMetadata).not.toHaveBeenCalled();
  });
});
