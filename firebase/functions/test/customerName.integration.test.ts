import { createHash } from "node:crypto";
import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateSalonCustomerName } from "../src/index";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
function input(uid: string | null, changes: Record<string, unknown> = {}) {
  return {
    auth: uid ? { uid, token: {} } : undefined,
    data: {
      salonId: "salon-a",
      customerId: "customer-a",
      name: "  Anh   Minh  ",
      expectedName: "Khách 1028",
      ...changes,
    },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
describe("customer display name changes", () => {
  beforeEach(async () => {
    const reset = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!reset.ok) throw new Error("Emulator reset failed");
    await db.doc("salons/salon-a").set({ name: "Fixture", status: "active", isActive: true });
    await db.doc("branches/branch-a").set({ salonId: "salon-a", isActive: true });
    await db.doc("branches/branch-b").set({ salonId: "salon-a", isActive: true });
    await db.doc("users/owner-a").set({ salonId: "salon-a", role: "owner", isActive: true });
    await db.doc("users/staff-a").set({
      salonId: "salon-a",
      role: "staff",
      isActive: true,
      branchIds: ["branch-a"],
      inviteStatus: "accepted",
    });
    await db.doc("customers/customer-a").set({
      salonId: "salon-a",
      firebaseUid: "phone-uid",
      phone: "0900001028",
      phoneLast4: "1028",
      name: "Khách 1028",
      points: 3,
      allowPhoto: false,
    });
    await db.doc("point_requests/request-a").set({
      salonId: "salon-a",
      customerId: "customer-a",
      sessionId: "session-a",
      branchId: "branch-a",
      status: "pending",
      approvalMode: "staff_confirmation",
      expiresAt: Timestamp.fromMillis(Date.now() + 600000),
      customerSummary: { name: "Khách 1028", points: 3, allowPhoto: false },
    });
    await db.doc("chair_sessions/session-a").set({
      salonId: "salon-a",
      customerId: "customer-a",
      branchId: "branch-a",
      status: "pending_approval",
      customerSummary: { name: "Khách 1028", points: 3, allowPhoto: false },
    });
    const activeId = createHash("sha256").update("salon-a:customer-a").digest("hex").slice(0, 40);
    await db
      .doc(`active_service_sessions/${activeId}`)
      .set({ salonId: "salon-a", customerId: "customer-a", sessionId: "session-a" });
    await db.doc("haircut_records/history-a").set({
      salonId: "salon-a",
      customerId: "customer-a",
      customerName: "Khách 1028",
      pointsAdded: 1,
    });
  });
  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("owner changes the directory name without changing identity, points or completed history", async () => {
    const result = await updateSalonCustomerName.run(input("owner-a"));
    expect(result).toMatchObject({ customerId: "customer-a", name: "Anh Minh" });
    expect((await db.doc("customers/customer-a").get()).data()).toMatchObject({
      firebaseUid: "phone-uid",
      phone: "0900001028",
      points: 3,
      name: "Anh Minh",
      nameSearch: "anh minh",
    });
    expect((await db.doc("haircut_records/history-a").get()).data()?.customerName).toBe(
      "Khách 1028",
    );
  });
  it("staff can update the pending request summary in their assigned branch", async () => {
    await updateSalonCustomerName.run(
      input("staff-a", { pointRequestId: "request-a", uid: "owner-a" }),
    );
    expect((await db.doc("point_requests/request-a").get()).data()).toMatchObject({
      status: "pending",
      customerSummary: { name: "Anh Minh", points: 3, allowPhoto: false },
    });
    expect((await db.doc("chair_sessions/session-a").get()).data()?.customerSummary.name).toBe(
      "Anh Minh",
    );
    expect((await db.doc("customers/customer-a").get()).data()?.namePrefixes).toContain("minh");
    const audit = await db
      .collection("audit_events")
      .where("action", "==", "customer.name_updated")
      .get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data().actorUid).toBe("staff-a");
    expect(JSON.stringify(audit.docs[0].data())).not.toContain("Anh Minh");
  });
  it("owner can rename a customer without an active service", async () => {
    await db
      .collection("active_service_sessions")
      .get()
      .then((snapshot) => Promise.all(snapshot.docs.map((doc) => doc.ref.delete())));
    await updateSalonCustomerName.run(input("owner-a"));
    expect((await db.doc("customers/customer-a").get()).data()?.name).toBe("Anh Minh");
  });
  it("blocks another salon", async () => {
    await expect(
      updateSalonCustomerName.run(input("owner-a", { salonId: "salon-b" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect((await db.doc("customers/customer-a").get()).data()?.name).toBe("Khách 1028");
  });
  it("staff cannot rename without a pending request", async () => {
    await expect(updateSalonCustomerName.run(input("staff-a"))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
  it("staff cannot use a different customer's request", async () => {
    await db.doc("point_requests/request-a").update({ customerId: "customer-b" });
    await expect(
      updateSalonCustomerName.run(input("staff-a", { pointRequestId: "request-a" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("staff cannot use a request at an unassigned branch", async () => {
    await db.doc("point_requests/request-a").update({ branchId: "branch-b" });
    await expect(
      updateSalonCustomerName.run(input("staff-a", { pointRequestId: "request-a" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
  it.each(["approved", "rejected"])("staff cannot edit a %s request", async (status) => {
    await db.doc("point_requests/request-a").update({ status });
    await expect(
      updateSalonCustomerName.run(input("staff-a", { pointRequestId: "request-a" })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("rejects expired point requests", async () => {
    await db
      .doc("point_requests/request-a")
      .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(
      updateSalonCustomerName.run(input("staff-a", { pointRequestId: "request-a" })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("rejects stale name edits rather than overwriting a newer name", async () => {
    await db.doc("customers/customer-a").update({ name: "Tên mới đã lưu" });
    await expect(updateSalonCustomerName.run(input("owner-a"))).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "CUSTOMER_NAME_CHANGED" },
    });
    expect((await db.doc("customers/customer-a").get()).data()?.name).toBe("Tên mới đã lưu");
  });
  it.each(["", " ", "x".repeat(81), 123, "Tên\u0000sai"])(
    "rejects invalid name %j",
    async (name) => {
      await expect(updateSalonCustomerName.run(input("owner-a", { name }))).rejects.toMatchObject({
        code: "invalid-argument",
      });
    },
  );
  it("rejects unauthenticated and customer-only identities", async () => {
    await expect(updateSalonCustomerName.run(input(null))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(updateSalonCustomerName.run(input("phone-uid"))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
  it.each([{ isActive: false }, { inviteStatus: "pending" }])(
    "blocks a revoked or unaccepted staff membership %j",
    async (patch) => {
      await db.doc("users/staff-a").update(patch);
      await expect(
        updateSalonCustomerName.run(input("staff-a", { pointRequestId: "request-a" })),
      ).rejects.toMatchObject({ code: "permission-denied" });
    },
  );
  it("applies a named authenticated rate limit", async () => {
    const start = Math.floor(Date.now() / 60000) * 60000;
    for (const window of [start - 60000, start, start + 60000]) {
      const id = createHash("sha256")
        .update(`updateSalonCustomerName:owner-a:salon-a:${window}`)
        .digest("hex");
      await db.doc(`_authenticated_rate_limits/${id}`).set({ count: 1000 });
    }
    await expect(updateSalonCustomerName.run(input("owner-a"))).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });
});
