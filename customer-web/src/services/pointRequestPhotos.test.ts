import { describe, expect, it } from "vitest";
import { legacyPhotoUrlsFor, photoItemsFor, storedPhotoCount } from "./pointRequestPhotos";
const legacy = "https://firebasestorage.googleapis.com/v0/b/demo/o/legacy.jpg?token=old-fixture";
const signed = "https://storage.googleapis.com/demo/legacy.jpg?X-Goog-Expires=900";
describe("point request photo identity and display", () => {
  it("keeps legacy identity for edits but displays only the resolved link", () => {
    const request = { legacyPhotoUrls: [legacy], photoPaths: [], photoUrls: [signed] };
    expect(legacyPhotoUrlsFor(request)).toEqual([legacy]);
    expect(photoItemsFor(request)).toEqual([{ id: legacy, url: signed }]);
  });
  it("uses stable source IDs when one image is missing or reordered", () => {
    const request = { legacyPhotoUrls: [legacy], photoPaths: ["path-a", "path-b"], photoUrls: ["url-b"], photoReadUrls: { "path-b": "url-b" } };
    expect(photoItemsFor(request)).toEqual([{ id: "path-b", url: "url-b" }]);
    expect(storedPhotoCount(request)).toBe(3);
  });
  it("does not resurrect a permanent URL after a read failure", () => {
    const request = { legacyPhotoUrls: [legacy], photoPaths: ["path-a"], photoUrls: [], photoReadUrls: {} };
    expect(photoItemsFor(request)).toEqual([]);
    expect(storedPhotoCount(request)).toBe(2);
  });
  it("retains the existing fallback shape for entries without separate legacy metadata", () => {
    const request = { photoUrls: [signed, "url-a"], photoPaths: ["path-a"] };
    expect(photoItemsFor(request)).toEqual([{ id: signed, url: signed }, { id: "path-a", url: "url-a" }]);
  });
});
