import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/index";
import {
  createPrivatePhotoReader,
  PRIVATE_PHOTO_URL_TTL_MS,
} from "../src/domains/photos/privatePhotoAccess";
import { requireFirestoreEmulator, requireRulesEmulators } from "./emulatorEnvironment";
import { TEST_JPEG } from "./fixtures/jpeg";
import { PRIVATE_PHOTO_CACHE_CONTROL } from "../src/domains/photos/photoDownloadTokens";

requireRulesEmulators();
const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const bucket = getStorage().bucket();
const operationId = `op-${"b".repeat(40)}`;
const path = `salons/photo-salon/customers/photo-customer/sessions/photo-session/${operationId}.jpg`;
const legacyPath =
  "salons/photo-salon/customers/photo-customer/haircuts/photo-session/photo-123456789abc.jpg";
const now = Date.now();
const signer = vi.fn(
  async (object: string, expires: number) =>
    `https://storage.googleapis.com/test/${encodeURIComponent(object)}?expires=${expires}`,
);
const limiter = vi.fn(async () => undefined);
const read = createPrivatePhotoReader(db, bucket, limiter, signer, () => now);
const request = (uid = "photo-owner", photoPaths = [path]) => ({
  auth: { uid },
  data: {
    salonId: "photo-salon",
    customerId: "photo-customer",
    sessionId: "photo-session",
    photoPaths,
  },
});

describe("private photo read authorization", () => {
  beforeEach(async () => {
    expect(bucket.name.startsWith("demo-")).toBe(true);
    const cleared = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!cleared.ok) throw new Error("Cannot clear local fixture");
    await bucket.deleteFiles({ force: true });
    signer.mockClear();
    limiter.mockClear();
    await Promise.all([
      db.doc("salons/photo-salon").set({ status: "active", isActive: true }),
      db.doc("users/photo-owner").set({ role: "owner", salonId: "photo-salon", isActive: true }),
      db.doc("users/photo-staff").set({
        role: "staff",
        salonId: "photo-salon",
        isActive: true,
        branchIds: ["photo-branch"],
      }),
      db.doc("users/photo-other-staff").set({
        role: "staff",
        salonId: "photo-salon",
        isActive: true,
        branchIds: ["other-branch"],
      }),
      db.doc("users/other-owner").set({ role: "owner", salonId: "other-salon", isActive: true }),
      db.doc("customers/photo-customer").set({ salonId: "photo-salon", allowPhoto: true }),
      db.doc("chair_sessions/photo-session").set({
        salonId: "photo-salon",
        customerId: "photo-customer",
        branchId: "photo-branch",
        status: "completed",
        assignedStaffId: "photo-staff",
      }),
      db.doc(`photo_upload_operations/${operationId}`).set({
        status: "finalized",
        salonId: "photo-salon",
        customerId: "photo-customer",
        sessionId: "photo-session",
        storagePath: path,
        staffUid: "photo-staff",
        attachmentStatus: "attached",
      }),
    ]);
    for (const object of [path, legacyPath])
      await bucket.file(object).save(TEST_JPEG, {
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            firebaseStorageDownloadTokens: "fixture-private-token",
            uploaderUid: "photo-staff",
          },
        },
      });
  });
  afterAll(async () => {
    await bucket.deleteFiles({ force: true });
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("requires authentication and the actual salon membership", async () => {
    await expect(read({ data: request().data })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(read(request("other-owner"))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(read(request("missing-user"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(signer).not.toHaveBeenCalled();
  });
  it("issues bounded URLs to owner and assigned staff without exposing permanent tokens", async () => {
    const result = await read(request());
    expect(result.expiresAtMs).toBe(now + PRIVATE_PHOTO_URL_TTL_MS);
    expect(PRIVATE_PHOTO_URL_TTL_MS).toBeLessThanOrEqual(15 * 60_000);
    expect(result.photos).toEqual([
      { path, url: expect.stringContaining("storage.googleapis.com/") },
    ]);
    expect(JSON.stringify(result)).not.toContain("fixture-private-token");
    expect(signer).toHaveBeenCalledWith(path, now + PRIVATE_PHOTO_URL_TTL_MS);
    const [metadata] = await bucket.file(path).getMetadata();
    // Metadata-null semantics are proven in the real synthetic canary; the
    // emulator has a separate retained token array. Still verify the helper ran.
    expect(metadata.cacheControl).toBe(PRIVATE_PHOTO_CACHE_CONTROL);
    const [bytes] = await bucket.file(path).download();
    expect(bytes).toEqual(TEST_JPEG);
    await expect(read(request("photo-staff"))).resolves.toHaveProperty("photos");
  });
  it("keeps legacy photos readable through the same authorized path", async () => {
    const result = await read(request("photo-owner", [legacyPath]));
    expect(result.photos[0].path).toBe(legacyPath);
    expect(result.photos[0].url).not.toContain("firebasestorage.googleapis.com");
  });
  it("denies another branch and a same-branch employee not assigned to the session", async () => {
    await expect(read(request("photo-other-staff"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await db.doc("users/photo-other-staff").update({ branchIds: ["photo-branch"] });
    await expect(read(request("photo-other-staff"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(signer).not.toHaveBeenCalled();
  });
  it("supports only the actual uploader for the staff-confirmation photo flow", async () => {
    await db.doc("chair_sessions/photo-session").update({
      approvalMode: "staff_confirmation",
      photoConsentGranted: true,
      assignedStaffId: null,
    });
    await expect(read(request("photo-staff"))).resolves.toHaveProperty("photos");
    await db.doc("users/photo-other-staff").update({ branchIds: ["photo-branch"] });
    await expect(read(request("photo-other-staff"))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
  it("rechecks current membership and consent for each URL request", async () => {
    await read(request());
    signer.mockClear();
    await db.doc("users/photo-owner").update({ isActive: false });
    await expect(read(request())).rejects.toMatchObject({ code: "permission-denied" });
    await db.doc("users/photo-owner").update({ isActive: true });
    await db.doc("customers/photo-customer").update({ allowPhoto: false });
    await expect(read(request())).rejects.toMatchObject({ code: "permission-denied" });
    expect(signer).not.toHaveBeenCalled();
  });
  it("rejects mismatched customer/session tenant data", async () => {
    await db.doc("chair_sessions/photo-session").update({ customerId: "other-customer" });
    await expect(read(request())).rejects.toMatchObject({ code: "permission-denied" });
    expect(signer).not.toHaveBeenCalled();
  });
  it("rejects external URLs, foreign paths and oversized path lists", async () => {
    for (const photoPaths of [
      ["https://example.com/private.jpg"],
      [path.replace("photo-salon", "other-salon")],
      [path, path, path, path],
    ]) {
      await expect(read(request("photo-owner", photoPaths))).rejects.toMatchObject({
        code: "invalid-argument",
      });
    }
    expect(signer).not.toHaveBeenCalled();
  });
  it("rejects missing context, invalid IDs, and empty lists before storage access", async () => {
    for (const data of [
      null,
      [],
      {},
      { ...request().data, salonId: "a/b" },
      { ...request().data, photoPaths: [] },
    ]) {
      await expect(read({ auth: { uid: "photo-owner" }, data })).rejects.toMatchObject({
        code: "invalid-argument",
      });
    }
    expect(signer).not.toHaveBeenCalled();
  });
  it("deduplicates allowed paths without widening the session", async () => {
    const result = await read(request("photo-owner", [path, path]));
    expect(result.photos).toHaveLength(1);
    expect(signer).toHaveBeenCalledOnce();
  });
  it("does not expose an unfinalized operation", async () => {
    await db.doc(`photo_upload_operations/${operationId}`).update({ status: "pending" });
    await expect(read(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(signer).not.toHaveBeenCalled();
  });
  it("fails closed on signing errors, never returning the old token URL", async () => {
    signer.mockRejectedValueOnce(new Error("signing unavailable"));
    await expect(read(request())).rejects.toMatchObject({ code: "unavailable" });
  });
});
