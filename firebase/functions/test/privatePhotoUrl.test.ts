import { describe, expect, it, vi } from "vitest";
import { privatePhotoUrl } from "../src/domains/photos/privatePhotoAccess";
import { PRIVATE_PHOTO_CACHE_CONTROL } from "../src/domains/photos/photoDownloadTokens";

const path = `salons/test/customers/test/sessions/test/op-${"a".repeat(40)}.jpg`;
function fixture() {
  const file = {
    name: path,
    getMetadata: vi.fn().mockResolvedValue([
      {
        contentType: "image/jpeg",
        size: "300",
        metageneration: "2",
        metadata: { firebaseStorageDownloadTokens: "fixture-only" },
      },
    ]),
    setMetadata: vi.fn().mockResolvedValue([]),
    getSignedUrl: vi.fn().mockResolvedValue(["https://storage.googleapis.com/fixture/signed"]),
  };
  const bucket = { file: vi.fn(() => file) };
  return { file, bucket };
}
describe("private haircut signing contract", () => {
  it("revokes the old token then signs a bounded JPEG read without exposing it", async () => {
    const { file, bucket } = fixture();
    const expiry = Date.now() + 900_000;
    expect(await privatePhotoUrl(bucket as never, path, expiry)).toBe(
      "https://storage.googleapis.com/fixture/signed",
    );
    expect(file.setMetadata).toHaveBeenCalledWith(
      {
        cacheControl: PRIVATE_PHOTO_CACHE_CONTROL,
        metadata: { firebaseStorageDownloadTokens: null },
      },
      { ifMetagenerationMatch: "2" },
    );
    expect(file.setMetadata.mock.invocationCallOrder[0]).toBeLessThan(
      file.getSignedUrl.mock.invocationCallOrder[0],
    );
    expect(file.getSignedUrl).toHaveBeenCalledWith({
      version: "v4",
      action: "read",
      expires: expiry,
      responseType: "image/jpeg",
      responseDisposition: "inline",
    });
  });
  it("refuses arbitrary paths without storage calls", async () => {
    const { bucket } = fixture();
    await expect(
      privatePhotoUrl(bucket as never, "salons/test/branding/avatar.webp", Date.now()),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(bucket.file).not.toHaveBeenCalled();
  });
  it.each([
    { contentType: "text/html", size: "300" },
    { contentType: "image/jpeg", size: "0" },
    { contentType: "image/jpeg", size: String(3 * 1024 * 1024 + 1) },
  ])("refuses invalid object metadata %j", async (metadata) => {
    const { file, bucket } = fixture();
    file.getMetadata.mockResolvedValue([metadata]);
    await expect(privatePhotoUrl(bucket as never, path, Date.now())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(file.getSignedUrl).not.toHaveBeenCalled();
  });
  it("does not sign if revocation fails", async () => {
    const { file, bucket } = fixture();
    file.setMetadata.mockRejectedValue({ code: 403 });
    await expect(privatePhotoUrl(bucket as never, path, Date.now())).rejects.toMatchObject({
      code: 403,
    });
    expect(file.getSignedUrl).not.toHaveBeenCalled();
  });
});
