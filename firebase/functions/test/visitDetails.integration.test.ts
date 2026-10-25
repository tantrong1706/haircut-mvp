import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { beginHaircutPhotoUpload, finalizeHaircutPhotoUpload } from "../src/index";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { TEST_JPEG } from "./fixtures/jpeg";
import {
  createVisitDetailsApi,
  assertLatestCompletedPhotoVisit,
} from "../src/domains/photos/visitDetails";
import { requireFirestoreEmulator } from "./emulatorEnvironment";
const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const limiter = vi.fn(async () => {});
const api = createVisitDetailsApi(db, limiter);
const request = (uid = "owner", data: Record<string, unknown> = {}) => ({
  auth: { uid },
  data: { salonId: "salon", customerId: "customer", ...data },
});
const createdAt = Timestamp.fromMillis(1234567890000);
describe("latest completed haircut internal edits", () => {
  it("accepts the actual Web callable transport metadata when saving a completed visit", async () => {
    await expect(
      api.update(
        request("owner", {
          recordId: "record",
          revision: 0,
          note: "Web metadata",
          appVersion: "0.1.0",
          platform: "web",
        }),
      ),
    ).resolves.toEqual({ revision: 1 });
  });
  it.each([
    { revision: -1, note: "x" },
    { revision: 0, note: 42 },
    { revision: 0, note: "x".repeat(1001) },
    { revision: 0, photoConsentConfirmed: false },
    { revision: 0, addPhotoPaths: "bad" },
    { revision: 0, addPhotoPaths: [1] },
    { revision: 0, addPhotoPaths: ["a", "b", "c", "d"] },
    { revision: 0 },
  ])("rejects malformed update payload %j", async (data) => {
    await expect(
      api.update(request("owner", { recordId: "record", ...data })),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("requires authentication and valid scoped IDs", async () => {
    await expect(api.read({ data: {} })).rejects.toMatchObject({ code: "unauthenticated" });
    for (const data of [
      null,
      [],
      { salonId: "../bad", customerId: "customer" },
      { salonId: "salon", customerId: "" },
    ])
      await expect(api.read({ auth: { uid: "owner" }, data })).rejects.toMatchObject({
        code: "invalid-argument",
      });
    await expect(
      db.runTransaction((tx) =>
        assertLatestCompletedPhotoVisit(db, tx, {
          uid: "owner",
          salonId: "salon",
          customerId: "customer",
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("rejects invalid linkage and a missing latest visit", async () => {
    await db.doc("haircut_records/record").delete();
    await expect(api.read(request())).rejects.toMatchObject({ code: "not-found" });
  });
  it.each([
    ["haircut_records/record", { pointRequestId: "" }],
    ["chair_sessions/session", { status: "pending_approval" }],
    ["chair_sessions/session", { customerId: "foreign" }],
    ["branches/branch", { isActive: false }],
    ["point_requests/point", { status: "pending" }],
  ] as const)("rejects invalid record state %s", async (path, fields) => {
    await db.doc(path).update(fields);
    await expect(api.read(request())).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("allows internal photos only with consent, without granting edit rights to another stylist", async () => {
    await db
      .doc("users/colleague")
      .set({ salonId: "salon", role: "staff", isActive: true, branchIds: ["branch"] });
    await expect(
      api.update(
        request("colleague", { recordId: "record", revision: 0, note: "Other staff edit" }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await api.update(
      request("owner", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
    );
    const signer = vi.fn(async () => ["https://example.invalid/private.jpg"]);
    const reader = createVisitDetailsApi(db, limiter, signer);
    expect((await reader.read(request())).photoUrls).toHaveLength(1);
    await db.doc("customers/customer").update({ allowPhoto: false });
    expect((await reader.read(request())).photoUrls).toEqual([]);
    expect(signer).toHaveBeenCalledTimes(1);
  });
  it("checks maintenance, visit consent and photo limits before attachment", async () => {
    const payload = { recordId: "record", revision: 0, addPhotoPaths: ["fake"] };
    await expect(api.update(request("owner", payload))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await db.doc("system_config/features").set({ maintenanceMode: true });
    await expect(
      api.update(request("owner", { recordId: "record", revision: 0, note: "x" })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await db.doc("system_config/features").delete();
    await api.update(
      request("owner", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
    );
    await expect(api.update(request("owner", { ...payload, revision: 1 }))).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await db.doc("haircut_records/record").update({ photoPaths: ["one", "two", "three"] });
    await expect(api.update(request("owner", { ...payload, revision: 1 }))).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
  it.each([false, true])(
    "validates real JPEG finalization and rejects a newer visit after the grant (newer=%s)",
    async (newer) => {
      await api.update(
        request("staff", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
      );
      const checksum = createHash("sha256").update(TEST_JPEG).digest("hex");
      const input = {
        salonId: "salon",
        sessionId: "session",
        recordId: "record",
        requestId: "synthetic-real-jpeg",
        expectedContentType: "image/jpeg",
        expectedBytes: TEST_JPEG.length,
        checksum,
      };
      const begin = await beginHaircutPhotoUpload.run({
        auth: { uid: "staff", token: {} },
        data: input,
      } as never);
      const bucket = getStorage().bucket();
      expect(bucket.name.startsWith("demo-")).toBe(true);
      const file = bucket.file(begin.storagePath);
      try {
        await file.save(TEST_JPEG, {
          metadata: {
            contentType: "image/jpeg",
            metadata: {
              salonId: "salon",
              branchId: "branch",
              customerId: "customer",
              sessionId: "session",
              uploaderUid: "staff",
              operationId: begin.operationId,
              requestId: input.requestId,
              checksum,
            },
          },
        });
        if (newer)
          await db
            .doc("haircut_records/newer")
            .set({ salonId: "salon", customerId: "customer", createdAt: Timestamp.now() });
        const finalize = finalizeHaircutPhotoUpload.run({
          auth: { uid: "staff", token: {} },
          data: { salonId: "salon", operationId: begin.operationId },
        } as never);
        if (newer) {
          await expect(finalize).rejects.toMatchObject({ code: "failed-precondition" });
        } else {
          await expect(finalize).resolves.toMatchObject({ status: "finalized" });
          await api.update(
            request("staff", {
              recordId: "record",
              revision: 1,
              addPhotoPaths: [begin.storagePath],
            }),
          );
          expect((await db.doc("haircut_records/record").get()).data()?.photoPaths).toEqual([
            begin.storagePath,
          ]);
        }
        expect((await db.doc("customers/customer").get()).data()?.points).toBe(7);
      } finally {
        await file.delete({ ignoreNotFound: true });
      }
    },
  );
  beforeEach(async () => {
    const reset = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!reset.ok) throw new Error("Cannot reset synthetic fixture");
    await Promise.all([
      db.doc("salons/salon").set({ status: "active", isActive: true }),
      db.doc("branches/branch").set({ salonId: "salon", isActive: true }),
      db.doc("users/owner").set({ salonId: "salon", role: "owner", isActive: true }),
      db
        .doc("users/staff")
        .set({ salonId: "salon", role: "staff", isActive: true, branchIds: ["branch"] }),
      db.doc("users/outsider").set({ salonId: "other", role: "owner", isActive: true }),
      db
        .doc("users/wrong-branch")
        .set({ salonId: "salon", role: "staff", isActive: true, branchIds: ["elsewhere"] }),
      db.doc("customers/customer").set({
        salonId: "salon",
        points: 7,
        allowPhoto: true,
        nextPointEligibleAt: createdAt,
        lastVisitAt: createdAt,
      }),
      db.doc("chair_sessions/session").set({
        salonId: "salon",
        branchId: "branch",
        customerId: "customer",
        status: "completed",
        assignedStaffId: "staff",
        source: "staff_phone_lookup",
        approvalMode: "staff_confirmation",
        completedAt: createdAt,
      }),
      db.doc("point_requests/point").set({
        salonId: "salon",
        branchId: "branch",
        customerId: "customer",
        sessionId: "session",
        status: "approved",
        pointsAdded: 1,
      }),
      db.doc("haircut_records/record").set({
        salonId: "salon",
        branchId: "branch",
        customerId: "customer",
        pointRequestId: "point",
        staffId: "staff",
        createdAt,
        pointsAdded: 1,
        note: "Original",
        photoUrls: [],
        photoPaths: [],
      }),
    ]);
  });
  afterAll(async () => {
    await Promise.all(getApps().map(deleteApp));
  });
  it("loads the latest exact record and updates notes without adding points or visits", async () => {
    expect(await api.read(request())).toMatchObject({
      recordId: "record",
      sessionId: "session",
      revision: 0,
      note: "Original",
    });
    const before = (await db.doc("customers/customer").get()).data();
    await api.update(
      request("staff", { recordId: "record", revision: 0, note: "New internal style" }),
    );
    expect((await db.doc("haircut_records/record").get()).data()).toMatchObject({
      note: "New internal style",
      createdAt,
      pointsAdded: 1,
      detailsRevision: 1,
    });
    expect((await db.doc("customers/customer").get()).data()).toEqual(before);
    expect((await db.doc("chair_sessions/session").get()).data()).toMatchObject({
      status: "completed",
      completedAt: createdAt,
    });
    expect((await db.collection("haircut_records").get()).size).toBe(1);
  });
  it("denies customers, other salons, unassigned branches and inactive staff", async () => {
    for (const uid of ["customer", "outsider", "wrong-branch"])
      await expect(api.read(request(uid))).rejects.toMatchObject({ code: "permission-denied" });
    await db.doc("users/staff").update({ isActive: false });
    await expect(
      api.update(request("staff", { recordId: "record", revision: 0, note: "Forged" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("rejects stale revisions and editing older visits", async () => {
    await api.update(request("owner", { recordId: "record", revision: 0, note: "First" }));
    await expect(
      api.update(request("owner", { recordId: "record", revision: 0, note: "Stale" })),
    ).rejects.toMatchObject({ code: "aborted" });
    await db
      .doc("haircut_records/newer")
      .set({ salonId: "salon", customerId: "customer", createdAt: Timestamp.now() });
    await expect(
      api.update(request("owner", { recordId: "record", revision: 1, note: "Old" })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("rejects broken point/session linkage and unexpected fields", async () => {
    await expect(
      api.update(
        request("owner", { recordId: "record", revision: 0, note: "New", pointsAdded: 99 }),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await db.doc("point_requests/point").update({ customerId: "other-customer" });
    await expect(api.read(request())).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("requires current customer consent and explicit per-visit photo consent", async () => {
    const input = {
      uid: "staff",
      salonId: "salon",
      customerId: "customer",
      sessionId: "session",
      recordId: "record",
    };
    await expect(
      db.runTransaction((tx) => assertLatestCompletedPhotoVisit(db, tx, input)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await api.update(
      request("staff", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
    );
    await expect(
      db.runTransaction((tx) => assertLatestCompletedPhotoVisit(db, tx, input)),
    ).resolves.toBeDefined();
    await db.doc("customers/customer").update({ allowPhoto: false });
    await expect(
      db.runTransaction((tx) => assertLatestCompletedPhotoVisit(db, tx, input)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(
      api.update(
        request("owner", { recordId: "record", revision: 1, photoConsentConfirmed: true }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("attaches only finalized uploads of this actor and record, retaining existing photos", async () => {
    await api.update(
      request("staff", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
    );
    const operationId = "op-" + "a".repeat(40);
    const path = `salons/salon/customers/customer/sessions/session/${operationId}.jpg`;
    await db.doc(`photo_upload_operations/${operationId}`).set({
      salonId: "salon",
      branchId: "branch",
      customerId: "customer",
      sessionId: "session",
      recordId: "record",
      staffUid: "staff",
      storagePath: path,
      status: "pending",
      attachmentStatus: "unattached",
    });
    await expect(
      api.update(request("staff", { recordId: "record", revision: 1, addPhotoPaths: [path] })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await db
      .doc(`photo_upload_operations/${operationId}`)
      .update({ status: "finalized", orphanExpiresAt: Timestamp.fromMillis(Date.now() + 600000) });
    await api.update(request("staff", { recordId: "record", revision: 1, addPhotoPaths: [path] }));
    expect((await db.doc("haircut_records/record").get()).data()?.photoPaths).toEqual([path]);
    expect(
      (await db.doc(`photo_upload_operations/${operationId}`).get()).data()?.attachmentStatus,
    ).toBe("attached");
    expect((await db.doc("customers/customer").get()).data()?.points).toBe(7);
  });
  it("issues a bounded upload grant only for the authorized latest completed record", async () => {
    await api.update(
      request("staff", { recordId: "record", revision: 0, photoConsentConfirmed: true }),
    );
    const input = {
      salonId: "salon",
      sessionId: "session",
      recordId: "record",
      requestId: "synthetic-upload",
      expectedContentType: "image/jpeg",
      expectedBytes: 400,
      checksum: "a".repeat(64),
    };
    const result = await beginHaircutPhotoUpload.run({
      auth: { uid: "staff", token: {} },
      data: input,
    } as never);
    expect(
      (await db.doc(`photo_upload_operations/${result.operationId}`).get()).data(),
    ).toMatchObject({ recordId: "record", sessionId: "session", status: "pending" });
    await expect(
      beginHaircutPhotoUpload.run({
        auth: { uid: "staff", token: {} },
        data: { ...input, recordId: "wrong" },
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
