import { createHash } from "node:crypto";
import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_PHOTO_CACHE_CONTROL } from "../src/domains/photos/photoDownloadTokens";
import {
  beginHaircutPhotoUpload,
  cancelHaircutPhotoUpload,
  finalizeHaircutPhotoUpload,
  getRecoverableHaircutPhotoUploads,
  submitPointRequest,
  approvePointRequest,
} from "../src/index";
import { requireFirestoreEmulator, requireRulesEmulators } from "./emulatorEnvironment";
import { TEST_JPEG } from "./fixtures/jpeg";

requireRulesEmulators();
const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const bucket = getStorage().bucket();
const TEST_JPEG_CHECKSUM = createHash("sha256").update(TEST_JPEG).digest("hex");

describe("photo upload operation callables", () => {
  it("sends the conditional revocation patch before finalization returns without changing bytes", async () => {
    const begin = await beginOperation("photo-request-revoke-token");
    await saveUploadedObject(begin);
    const file = bucket.file(begin.storagePath);
    const token = "local-fixture-download-token";
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    expect(host).toMatch(/^(127\.0\.0\.1|localhost):\d+$/);
    const url = `http://${host}/v0/b/${bucket.name}/o/${encodeURIComponent(begin.storagePath)}?alt=media&token=${token}`;
    expect((await fetch(url)).status).toBe(200);
    const [initial] = await file.getMetadata();
    const patch = vi.spyOn(Object.getPrototypeOf(file), "setMetadata");
    try {
      await finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      );
      expect(patch).toHaveBeenCalledWith(
        {
          cacheControl: PRIVATE_PHOTO_CACHE_CONTROL,
          metadata: { firebaseStorageDownloadTokens: null },
        },
        { ifMetagenerationMatch: String(initial.metageneration) },
      );
      const [metadata] = await file.getMetadata();
      expect(metadata.cacheControl).toBe(PRIVATE_PHOTO_CACHE_CONTROL);
      const [bytes] = await file.download();
      expect(bytes).toEqual(TEST_JPEG);
    } finally {
      patch.mockRestore();
    }
    // Storage emulator 15.22.3 retains a separate downloadTokens array after a GCS
    // null metadata patch. Real HTTP 200 -> 403 is verified by the isolated live
    // canary, not faked by patching the emulator. See docs/testing/photo-security.tdd.md.
  });
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error(`Không xóa được dữ liệu emulator: HTTP ${response.status}`);
    await bucket.deleteFiles({ force: true }).catch(() => undefined);
    await seedPhotoSession();
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("tạo operation idempotent và không cho tài khoản ngoài phiên sử dụng", async () => {
    const data = beginData("photo-request-idempotent");
    const first = await beginHaircutPhotoUpload.run(requestFor("staff-photo", data));
    const repeated = await beginHaircutPhotoUpload.run(requestFor("staff-photo", data));

    expect(repeated).toMatchObject(first);
    expect(
      (
        await db
          .collection("photo_upload_operations")
          .where("requestId", "==", data.requestId)
          .get()
      ).size,
    ).toBe(1);
    await expect(
      beginHaircutPhotoUpload.run(requestFor("staff-other", beginData("photo-request-other"))),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      beginHaircutPhotoUpload.run(
        requestFor("owner-other", { ...beginData("photo-request-tenant"), salonId: "salon-photo" }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("issues a five-minute private upload grant, capped by the QR request deadline", async () => {
    const deadline = Timestamp.fromMillis(Date.now() + 120_000);
    await db.doc("chair_sessions/session-photo").update({
      status: "pending_approval",
      approvalMode: "staff_confirmation",
      photoConsentGranted: true,
      expiresAt: deadline,
    });
    const begin = await beginOperation("photo-short-grant-fixture");
    const operation = (await db.doc(`photo_upload_operations/${begin.operationId}`).get()).data();
    expect(operation?.uploadGrantVersion).toBe(1);
    expect(operation?.uploadExpiresAt.toMillis()).toBeLessThanOrEqual(deadline.toMillis());
    expect(operation?.uploadExpiresAt.toMillis()).toBeGreaterThan(Date.now());
    await db
      .doc(`photo_upload_operations/${begin.operationId}`)
      .update({ uploadExpiresAt: Timestamp.fromMillis(Date.now() - 1) });
    await beginOperation("photo-short-grant-fixture");
    const renewed = (await db.doc(`photo_upload_operations/${begin.operationId}`).get()).data();
    expect(renewed?.uploadExpiresAt.toMillis()).toBeGreaterThan(Date.now());
    await db.doc("customers/customer-photo").update({ allowPhoto: false });
    await expect(beginOperation("photo-short-grant-fixture")).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("does not finalize a pending image after the photo feature is switched off", async () => {
    const begin = await beginOperation("photo-disabled-after-grant");
    await saveUploadedObject(begin);
    await db.doc("salons/salon-photo/settings/features").set({ photoUploadEnabled: false });
    await expect(
      finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(
      (await db.doc(`photo_upload_operations/${begin.operationId}`).get()).data()?.status,
    ).not.toBe("finalized");
  });

  it.each([
    ["disabled member", "users/staff-photo", { isActive: false }, "permission-denied"],
    ["removed tenant", "users/staff-photo", { salonId: "salon-other" }, "permission-denied"],
    ["disabled branch", "branches/branch-photo", { isActive: false }, "failed-precondition"],
    [
      "completed visit",
      "chair_sessions/session-photo",
      { status: "completed" },
      "permission-denied",
    ],
    [
      "global photo switch",
      "system_config/features",
      { photoUploadEnabled: false },
      "failed-precondition",
    ],
  ])("does not accept staged bytes after %s", async (_reason, path, data, code) => {
    const begin = await beginOperation("photo-grant-revoked-fixture");
    await saveUploadedObject(begin);
    await db.doc(path as string).set(data as Record<string, unknown>, { merge: true });
    await expect(
      finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      ),
    ).rejects.toMatchObject({ code });
    expect(
      (await db.doc(`photo_upload_operations/${begin.operationId}`).get()).data()?.status,
    ).not.toBe("finalized");
  });

  it("cho nhân viên đúng chi nhánh chụp ảnh cho yêu cầu QR đang chờ xác nhận", async () => {
    await db.collection("chair_sessions").doc("session-photo").set(
      {
        status: "pending_approval",
        approvalMode: "staff_confirmation",
        photoConsentGranted: true,
        assignedStaffId: null,
        assignedStaffName: null,
      },
      { merge: true },
    );

    await expect(
      beginHaircutPhotoUpload.run(requestFor("staff-photo", beginData("photo-request-qr"))),
    ).resolves.toMatchObject({ storagePath: expect.stringContaining("/sessions/session-photo/") });
    await expect(
      beginHaircutPhotoUpload.run(requestFor("staff-other", beginData("photo-request-qr-other"))),
    ).rejects.toMatchObject({ code: "permission-denied" });
    const begin = await beginOperation("photo-qr-confirm-complete");
    await saveUploadedObject(begin);
    await finalizeHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
    );
    await db
      .collection("point_requests")
      .doc("session-photo")
      .set({
        salonId: "salon-photo",
        branchId: "branch-photo",
        customerId: "customer-photo",
        sessionId: "session-photo",
        status: "pending",
        approvalMode: "staff_confirmation",
        photoConsentGranted: true,
        pointsRequested: 1,
        photoPaths: [],
        photoUrls: [],
        expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60_000),
      });
    await approvePointRequest.run(
      requestFor("staff-photo", {
        salonId: "salon-photo",
        requestId: "session-photo",
        photoPaths: [begin.storagePath],
        note: "Ảnh cùng lần tích điểm",
      }),
    );
    const records = await db
      .collection("haircut_records")
      .where("pointRequestId", "==", "session-photo")
      .get();
    expect(records.docs[0]?.data()).toMatchObject({
      staffId: "staff-photo",
      photoPaths: [begin.storagePath],
      note: "Ảnh cùng lần tích điểm",
      pointsAdded: 1,
    });
    expect(
      (await db.collection("photo_upload_operations").doc(begin.operationId).get()).data()
        ?.attachmentStatus,
    ).toBe("attached");
  });

  it("finalize idempotent, gắn ảnh đúng một lần và chặn xóa ảnh đã gắn", async () => {
    const begin = await beginOperation("photo-request-finalize");
    await saveUploadedObject(begin);

    const first = await finalizeHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
    );
    const repeated = await finalizeHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
    );
    expect(first).toMatchObject({ status: "finalized", alreadyFinalized: false });
    expect(repeated).toMatchObject({ status: "finalized", alreadyFinalized: true });

    await submitPointRequest.run(
      requestFor("staff-photo", {
        salonId: "salon-photo",
        sessionId: "session-photo",
        note: "Ảnh kiểm thử",
        photoUrls: [],
        photoPaths: [begin.storagePath],
      }),
    );
    expect(
      (await db.collection("photo_upload_operations").doc(begin.operationId).get()).data(),
    ).toMatchObject({
      status: "finalized",
      attachmentStatus: "attached",
      attachedTo: { type: "point_request", id: "session-photo" },
    });
    await expect(
      cancelHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("khôi phục ảnh finalize chưa gắn chỉ cho đúng staff và session", async () => {
    const begin = await beginOperation("photo-request-recovery");
    await saveUploadedObject(begin);
    await finalizeHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
    );

    const recovered = await getRecoverableHaircutPhotoUploads.run(
      requestFor("staff-photo", { salonId: "salon-photo", sessionId: "session-photo" }),
    );
    expect(recovered.photos).toHaveLength(1);
    expect(recovered.photos[0]).toMatchObject({
      id: begin.operationId,
      path: begin.storagePath,
      status: "finalized",
    });
    expect(recovered.photos[0]).not.toHaveProperty("url");
    await expect(
      getRecoverableHaircutPhotoUploads.run(
        requestFor("staff-other", { salonId: "salon-photo", sessionId: "session-photo" }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("returns an uploaded pending operation so the client can recover after reload", async () => {
    const begin = await beginOperation("photo-request-recover-pending");
    await saveUploadedObject(begin);

    const recovered = await getRecoverableHaircutPhotoUploads.run(
      requestFor("staff-photo", { salonId: "salon-photo", sessionId: "session-photo" }),
    );

    expect(recovered.photos).toEqual([
      expect.objectContaining({
        operationId: begin.operationId,
        path: begin.storagePath,
        status: "pending",
      }),
    ]);
  });

  it("từ chối finalize khi consent bị thu hồi giữa hai bước", async () => {
    const begin = await beginOperation("photo-request-consent");
    await saveUploadedObject(begin);
    await db
      .collection("customers")
      .doc("customer-photo")
      .set({ allowPhoto: false }, { merge: true });

    await expect(
      finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(
      (await db.collection("photo_upload_operations").doc(begin.operationId).get()).data(),
    ).toMatchObject({
      status: "failed",
      failureCode: "CONSENT_OR_SESSION_CHANGED",
    });
  });

  it("từ chối nội dung không phải JPEG dù metadata khai báo image/jpeg", async () => {
    const begin = await beginOperation("photo-request-invalid-content");
    await bucket.file(begin.storagePath).save(Buffer.from([0x25, 0x50, 0x44, 0x46]), {
      contentType: "image/jpeg",
      metadata: {
        metadata: {
          salonId: "salon-photo",
          branchId: "branch-photo",
          customerId: "customer-photo",
          sessionId: "session-photo",
          uploaderUid: "staff-photo",
          operationId: begin.operationId,
          requestId: begin.requestId,
          checksum: TEST_JPEG_CHECKSUM,
        },
      },
    });

    await expect(
      finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: begin.operationId }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(
      (await db.collection("photo_upload_operations").doc(begin.operationId).get()).data(),
    ).toMatchObject({
      status: "failed",
      cleanupStatus: "pending",
      failureCode: "INVALID_IMAGE_CONTENT",
    });
  });

  it("cancel chạy lại an toàn và operation hết hạn không finalize được", async () => {
    const cancelled = await beginOperation("photo-request-cancel");
    await saveUploadedObject(cancelled);
    const first = await cancelHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: cancelled.operationId }),
    );
    const repeated = await cancelHaircutPhotoUpload.run(
      requestFor("staff-photo", { salonId: "salon-photo", operationId: cancelled.operationId }),
    );
    expect(first).toMatchObject({ status: "cancelled", alreadyCancelled: false });
    expect(repeated).toMatchObject({ status: "cancelled", alreadyCancelled: true });
    await expect(bucket.file(cancelled.storagePath).exists()).resolves.toEqual([false]);

    const expired = await beginOperation("photo-request-expired");
    await saveUploadedObject(expired);
    await db
      .collection("photo_upload_operations")
      .doc(expired.operationId)
      .set({ expiresAt: Timestamp.fromMillis(Date.now() - 1) }, { merge: true });
    await expect(
      finalizeHaircutPhotoUpload.run(
        requestFor("staff-photo", { salonId: "salon-photo", operationId: expired.operationId }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

type BeginResult = {
  operationId: string;
  requestId: string;
  storagePath: string;
};

async function beginOperation(requestId: string): Promise<BeginResult> {
  return beginHaircutPhotoUpload.run(
    requestFor("staff-photo", beginData(requestId)),
  ) as Promise<BeginResult>;
}

function beginData(requestId: string) {
  return {
    salonId: "salon-photo",
    sessionId: "session-photo",
    requestId,
    expectedContentType: "image/jpeg",
    expectedBytes: TEST_JPEG.length,
    checksum: TEST_JPEG_CHECKSUM,
  };
}

async function saveUploadedObject(begin: BeginResult) {
  await bucket.file(begin.storagePath).save(TEST_JPEG, {
    contentType: "image/jpeg",
    metadata: {
      metadata: {
        salonId: "salon-photo",
        branchId: "branch-photo",
        customerId: "customer-photo",
        sessionId: "session-photo",
        uploaderUid: "staff-photo",
        operationId: begin.operationId,
        requestId: begin.requestId,
        checksum: TEST_JPEG_CHECKSUM,
      },
    },
  });
}

async function seedPhotoSession() {
  const now = Timestamp.now();
  await Promise.all([
    db.collection("salons").doc("salon-photo").set({
      name: "Salon ảnh",
      ownerId: "owner-photo",
      status: "active",
      isActive: true,
      pointPerVisit: 1,
    }),
    db.collection("branches").doc("branch-photo").set({
      salonId: "salon-photo",
      name: "Chi nhánh ảnh",
      isActive: true,
    }),
    db.collection("users").doc("owner-photo").set({
      salonId: "salon-photo",
      role: "owner",
      name: "Chủ salon",
      isActive: true,
    }),
    db
      .collection("users")
      .doc("staff-photo")
      .set({
        salonId: "salon-photo",
        role: "staff",
        name: "Nhân viên ảnh",
        isActive: true,
        branchIds: ["branch-photo"],
      }),
    db
      .collection("users")
      .doc("staff-other")
      .set({
        salonId: "salon-photo",
        role: "staff",
        name: "Nhân viên khác",
        isActive: true,
        branchIds: ["branch-other"],
      }),
    db.collection("users").doc("owner-other").set({
      salonId: "salon-other",
      role: "owner",
      name: "Chủ salon khác",
      isActive: true,
    }),
    db.collection("customers").doc("customer-photo").set({
      salonId: "salon-photo",
      name: "Khách ảnh",
      points: 0,
      allowPhoto: true,
      consentUpdatedAt: now,
    }),
    db
      .collection("chair_sessions")
      .doc("session-photo")
      .set({
        salonId: "salon-photo",
        branchId: "branch-photo",
        branchName: "Chi nhánh ảnh",
        customerId: "customer-photo",
        status: "serving",
        isOpen: true,
        assignedStaffId: "staff-photo",
        assignedStaffName: "Nhân viên ảnh",
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000),
      }),
  ]);
}

function requestFor(uid: string, data: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token: {} },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
