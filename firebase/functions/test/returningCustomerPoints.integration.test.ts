import { createHash } from "node:crypto";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createReturningCustomerPointAward } from "../src/domains/points/returningCustomerPoints";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();
const rateLimit = vi.fn(async () => undefined);
const featureCheck = vi.fn(async () => undefined);
const award = createReturningCustomerPointAward(db, { rateLimit, featureCheck });
const input = {
  salonId: "salon-test",
  branchId: "branch-a",
  customerId: "customer-a",
  phoneLast4: "5678",
  operationId: "operation-0000000001",
};
const request = (data = input, uid = "staff-a") => ({ auth: { uid }, data });
const activeId = createHash("sha256").update("salon-test:customer-a").digest("hex").slice(0, 40);

describe("returning customer points without QR", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Emulator reset failed");
    await Promise.all([
      db.doc("salons/salon-test").set({ name: "Test salon", status: "active", pointPerVisit: 2 }),
      db.doc("branches/branch-a").set({ salonId: "salon-test", name: "Branch A", isActive: true }),
      db.doc("branches/branch-b").set({ salonId: "salon-test", name: "Branch B", isActive: true }),
      db.doc("users/staff-a").set({
        salonId: "salon-test",
        role: "staff",
        name: "Staff A",
        isActive: true,
        branchIds: ["branch-a"],
        canAwardPointsDirectly: true,
      }),
      db.doc("customers/customer-a").set({
        salonId: "salon-test",
        name: "An",
        phoneLast4: "5678",
        points: 4,
        allowPhoto: false,
      }),
      db
        .doc("customers/customer-b")
        .set({ salonId: "salon-test", name: "Binh", phoneLast4: "5678", points: 7 }),
    ]);
  });
  afterAll(async () => {
    await Promise.all(getApps().map(deleteApp));
  });

  it("awards only the selected matching customer using server points and records the actor", async () => {
    const result = await award(request({ ...input, points: 999 } as typeof input));
    expect(result).toMatchObject({ pointsAdded: 2, pointsAfter: 6, alreadyProcessed: false });
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(6);
    expect((await db.doc("customers/customer-b").get()).data()?.points).toBe(7);
    const records = await db.collection("haircut_records").get();
    expect(records.size).toBe(1);
    expect(records.docs[0].data()).toMatchObject({
      customerId: "customer-a",
      branchId: "branch-a",
      staffId: "staff-a",
      pointsAdded: 2,
      source: "staff_phone_lookup",
    });
    expect(
      (
        await db
          .collection("audit_events")
          .where("action", "==", "point_request.returning_customer_awarded")
          .get()
      ).size,
    ).toBe(1);
    expect(rateLimit).toHaveBeenCalledWith("staff-a", "salon-test");
    expect(featureCheck).toHaveBeenCalled();
  });

  it("deduplicates the same operation, including retries after the cooldown expires", async () => {
    await award(request());
    await db.doc("customers/customer-a").update({
      lastVisitAt: Timestamp.fromMillis(1),
      nextPointEligibleAt: Timestamp.fromMillis(1),
    });
    expect(await award(request())).toMatchObject({ alreadyProcessed: true, pointsAfter: 6 });
    expect((await db.collection("haircut_records").get()).size).toBe(1);
    await expect(award(request({ ...input, customerId: "customer-b" }))).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("enforces the salon-wide two-hour cooldown for new operation IDs", async () => {
    await award(request());
    await expect(
      award(request({ ...input, operationId: "operation-0000000002" })),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "POINT_COOLDOWN" },
    });
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(6);
  });

  it("serializes two staff awards to exactly one increment", async () => {
    await db
      .doc("users/staff-b")
      .set({ ...(await db.doc("users/staff-a").get()).data(), name: "Staff B" });
    const results = await Promise.allSettled([
      award(request()),
      award(request({ ...input, operationId: "operation-0000000002" }, "staff-b")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(6);
    expect((await db.collection("haircut_records").get()).size).toBe(1);
  });

  it("rejects anonymous, disabled and unauthorized staff without changing points", async () => {
    await expect(award({ data: input })).rejects.toMatchObject({ code: "unauthenticated" });
    await db.doc("users/staff-a").update({ canAwardPointsDirectly: false });
    await expect(award(request())).rejects.toMatchObject({ code: "permission-denied" });
    await db.doc("users/staff-a").update({ canAwardPointsDirectly: true, isActive: false });
    await expect(award(request())).rejects.toMatchObject({ code: "permission-denied" });
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(4);
  });

  it("rejects other salons, other branches, mismatched suffixes and malformed IDs", async () => {
    await expect(award(request({ ...input, salonId: "other" }))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(award(request({ ...input, branchId: "branch-b" }))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(award(request({ ...input, phoneLast4: "9999" }))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(award(request({ ...input, customerId: "a/b" }))).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await expect(award(request({ ...input, phoneLast4: "123" }))).rejects.toMatchObject({
      code: "invalid-argument",
    });
    await db.doc("customers/customer-a").update({ salonId: "other" });
    await expect(award(request())).rejects.toMatchObject({ code: "not-found" });
  });

  it("does not bypass a pending QR request or discard that request", async () => {
    await db
      .doc(`active_service_sessions/${activeId}`)
      .set({ salonId: "salon-test", customerId: "customer-a", sessionId: "pending-qr" });
    await db.doc("chair_sessions/pending-qr").set({
      salonId: "salon-test",
      customerId: "customer-a",
      status: "pending_approval",
      isOpen: true,
      expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    });
    await expect(award(request())).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "ACTIVE_SESSION_EXISTS" },
    });
    expect((await db.doc(`active_service_sessions/${activeId}`).get()).exists).toBe(true);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(4);
  });

  it("blocks closed branches and suspended salons", async () => {
    await db.doc("branches/branch-a").update({ isActive: false });
    await expect(award(request())).rejects.toMatchObject({ code: "failed-precondition" });
    await db.doc("branches/branch-a").update({ isActive: true });
    await db.doc("salons/salon-test").update({ status: "suspended" });
    await expect(award(request())).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("keeps customers with the same suffix independent, even at the same time", async () => {
    await Promise.all([
      award(request()),
      award(request({ ...input, customerId: "customer-b", operationId: "operation-0000000002" })),
    ]);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(6);
    expect((await db.doc("customers/customer-b").get()).data()?.points).toBe(9);
    expect((await db.collection("haircut_records").get()).size).toBe(2);
  });

  it("allows a new visit after two hours and lets an owner use the same audited path", async () => {
    await award(request());
    await db.doc("customers/customer-a").update({
      lastVisitAt: Timestamp.fromMillis(Date.now() - 2 * 60 * 60_000 - 1000),
      nextPointEligibleAt: Timestamp.fromMillis(1),
    });
    await db.doc("users/owner").set({ salonId: "salon-test", role: "owner", isActive: true });
    expect(
      await award(request({ ...input, operationId: "operation-0000000002" }, "owner")),
    ).toMatchObject({ pointsAfter: 8 });
  });

  it("honors direct-award daily limits shared with the existing workflow", async () => {
    const date = new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
    const id = createHash("sha256").update(`salon-test:staff-a:${date}`).digest("hex");
    await db.doc(`staff_daily_point_awards/${id}`).set({ awards: 100, pointsAwarded: 200 });
    await expect(award(request())).rejects.toMatchObject({ code: "resource-exhausted" });
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(4);
  });

  it("rechecks permissions in the transaction after a concurrent revocation", async () => {
    rateLimit.mockImplementationOnce(async () => {
      await db.doc("users/staff-a").update({ canAwardPointsDirectly: false });
    });
    await expect(award(request())).rejects.toMatchObject({ code: "permission-denied" });
    expect((await db.collection("haircut_records").get()).size).toBe(0);
  });

  it("does not mutate points when feature gates or rate limits reject", async () => {
    featureCheck.mockRejectedValueOnce(new Error("fixture-feature-disabled"));
    await expect(award(request())).rejects.toThrow("fixture-feature-disabled");
    rateLimit.mockRejectedValueOnce(new Error("fixture-rate-limit"));
    await expect(award(request())).rejects.toThrow("fixture-rate-limit");
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(4);
  });

  it("fails closed for invalid balance/configuration and pending invitations", async () => {
    await db.doc("customers/customer-a").update({ points: -1 });
    await expect(award(request())).rejects.toMatchObject({ code: "failed-precondition" });
    await db.doc("customers/customer-a").update({ points: 4 });
    await db.doc("salons/salon-test").update({ pointPerVisit: 0 });
    await expect(award(request())).rejects.toMatchObject({ code: "failed-precondition" });
    await db.doc("users/staff-a").update({ inviteStatus: "pending" });
    await expect(award(request())).rejects.toMatchObject({ code: "permission-denied" });
  });
});
