import { beforeEach, describe, expect, it, vi } from "vitest";
const call = vi.hoisted(() => vi.fn());
vi.mock("./firebase", () => ({ callFunction: call }));
import {
  getPrivatePhotoUrls,
  getPrivatePhotoUrl,
  legacyPhotoPathFromUrl,
} from "./privatePhotoUrls";

const path = `salons/salon-a/customers/customer-a/sessions/session-a/op-${"a".repeat(40)}.jpg`;
const url = `https://storage.googleapis.com/demo-bucket/${path}?X-Goog-Expires=900`;
const input = {
  salonId: "salon-a",
  customerId: "customer-a",
  sessionId: "session-a",
  photoPaths: [path],
};
describe("private photo read links", () => {
  beforeEach(() => {
    call.mockReset();
    call.mockResolvedValue({ photos: [{ path, url }], expiresAtMs: Date.now() + 60_000 });
  });
  it("uses authenticated callable context and binds links to the requested object", async () => {
    expect(await getPrivatePhotoUrls(input)).toEqual({ [path]: url });
    expect(call).toHaveBeenCalledWith("getHaircutPhotoReadUrls", input);
    expect(await getPrivatePhotoUrl(path)).toBe(url);
  });
  it("does not call the server for an empty list", async () => {
    expect(await getPrivatePhotoUrls({ ...input, photoPaths: [] })).toEqual({});
    expect(call).not.toHaveBeenCalled();
  });
  it("checks the expected upload context even for a single URL", async () => {
    await expect(getPrivatePhotoUrl(path, { sessionId: "different" })).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
    expect(await getPrivatePhotoUrl(path, { salonId: "salon-a", sessionId: "session-a" })).toBe(
      url,
    );
  });
  it("rejects invalid response envelopes and privileged URL components", async () => {
    for (const result of [
      null,
      { photos: null, expiresAtMs: 1 },
      { photos: [{ path, url }], expiresAtMs: 0 },
      { photos: [null], expiresAtMs: 1 },
    ]) {
      call.mockResolvedValue(result);
      await expect(getPrivatePhotoUrls(input)).rejects.toThrow();
    }
    for (const bad of [
      url.replace("https://", "https://user:pass@"),
      url.replace(".com/", ".com:8443/"),
      url + "&token=fixture-only",
      "not-a-url",
    ]) {
      call.mockResolvedValue({ photos: [{ path, url: bad }], expiresAtMs: 1 });
      await expect(getPrivatePhotoUrls(input)).rejects.toThrow();
    }
    expect(legacyPhotoPathFromUrl("not-a-url", "demo-bucket")).toBeNull();
  });
  it("rejects foreign contexts, external URLs and oversized lists before making requests", async () => {
    for (const bad of [
      { ...input, salonId: "other" },
      { ...input, photoPaths: ["https://example.com/a.jpg"] },
      { ...input, photoPaths: [path, path, path, path] },
    ]) {
      await expect(getPrivatePhotoUrls(bad)).rejects.toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("never falls back to a persistent URL when signing is unavailable", async () => {
    call.mockRejectedValue(new Error("offline"));
    await expect(getPrivatePhotoUrls(input)).rejects.toThrow("offline");
  });
  it("rejects malformed, missing, foreign and persistent returned links", async () => {
    for (const photos of [
      [],
      [{ path: "other", url }],
      [{ path, url: "javascript:alert(1)" }],
      [{ path, url: "https://evil.test/a.jpg" }],
      [
        {
          path,
          url: `https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/${encodeURIComponent(path)}?token=fixture`,
        },
      ],
      [{ path, url: "https://storage.googleapis.com/demo-bucket/other.jpg" }],
    ]) {
      call.mockResolvedValue({ photos, expiresAtMs: Date.now() + 60_000 });
      await expect(getPrivatePhotoUrls(input)).rejects.toThrow();
    }
  });
  it("extracts only a vetted legacy object path, never its permanent token", () => {
    const legacy = "salons/salon-a/customers/customer-a/haircuts/session-a/photo-123456789abc.jpg";
    const source = `https://firebasestorage.googleapis.com/v0/b/demo-bucket/o/${encodeURIComponent(legacy)}?alt=media&token=fixture`;
    expect(legacyPhotoPathFromUrl(source, "demo-bucket")).toBe(legacy);
    expect(legacyPhotoPathFromUrl(source, "other-bucket")).toBeNull();
    expect(legacyPhotoPathFromUrl(source.replace("https:", "http:"), "demo-bucket")).toBeNull();
    expect(legacyPhotoPathFromUrl("https://example.com/a.jpg", "demo-bucket")).toBeNull();
  });
});
