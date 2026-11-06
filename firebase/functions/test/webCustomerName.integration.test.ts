import { createHash } from "node:crypto";
import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateWebCustomerName } from "../src/index";
import { customerIdForWeb } from "../src/customerWebIdentity";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const customerId = customerIdForWeb("salon-a", "uid-a");
const customerRef = db.doc(`customers/${customerId}`);
function request(
  uid: string | null = "uid-a",
  changes: Record<string, unknown> = {},
  provider = "phone",
) {
  return {
    auth: uid
      ? { uid, token: { phone_number: "+84901234567", firebase: { sign_in_provider: provider } } }
      : undefined,
    data: { salonId: "salon-a", name: "  Anh   Minh  ", expectedName: "Khách 4567", ...changes },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
describe("Web customer edits only their own display name", () => {
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Emulator reset failed");
    await db.doc("salons/salon-a").set({ status: "active", isActive: true });
    await customerRef.set({
      salonId: "salon-a",
      firebaseUid: "uid-a",
      name: "Khách 4567",
      phone: "0901234567",
      phoneLast4: "4567",
      points: 7,
      allowPhoto: false,
      activeSessionId: "session-a",
    });
    for (const collection of ["chair_sessions", "point_requests"])
      await db.doc(`${collection}/session-a`).set({
        salonId: "salon-a",
        customerId,
        status: collection === "chair_sessions" ? "pending_approval" : "pending",
        customerSummary: { name: "Khách 4567", points: 7 },
      });
    await db
      .doc("haircut_records/finished-a")
      .set({ salonId: "salon-a", customerId, customerName: "Khách 4567", pointsAdded: 1 });
    await db
      .doc("reward_history/reward-a")
      .set({ salonId: "salon-a", customerId, status: "unused" });
  });
  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });
  it("updates the owned profile and search indexes, not identity, points, rewards or completed history", async () => {
    expect(await updateWebCustomerName.run(request())).toMatchObject({
      customerId,
      name: "Anh Minh",
    });
    expect((await customerRef.get()).data()).toMatchObject({
      firebaseUid: "uid-a",
      phone: "0901234567",
      phoneLast4: "4567",
      points: 7,
      allowPhoto: false,
      name: "Anh Minh",
      nameSearch: "anh minh",
    });
    expect((await db.doc("haircut_records/finished-a").get()).data()?.customerName).toBe(
      "Khách 4567",
    );
    expect((await db.doc("reward_history/reward-a").get()).data()?.status).toBe("unused");
    const events = (await db.collection("audit_events").get()).docs.map((doc) => doc.data());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorUid: "uid-a",
      actorRole: "customer",
      action: "customer.name_updated",
      targetId: customerId,
    });
    expect(JSON.stringify(events)).not.toContain("Anh Minh");
  });
  it("updates only pending summaries and can rename without any open visit", async () => {
    await updateWebCustomerName.run(request());
    expect((await db.doc("point_requests/session-a").get()).data()?.customerSummary).toMatchObject({
      name: "Anh Minh",
      points: 7,
    });
    expect((await db.doc("chair_sessions/session-a").get()).data()?.customerSummary.name).toBe(
      "Anh Minh",
    );
    await customerRef.update({ activeSessionId: "" });
    await updateWebCustomerName.run(request("uid-a", { name: "Minh", expectedName: "Anh Minh" }));
    expect((await customerRef.get()).data()?.name).toBe("Minh");
  });
  it("ignores forged uid/customer/contact/point fields and never renames another account", async () => {
    const other = db.doc(`customers/${customerIdForWeb("salon-a", "uid-b")}`);
    await other.set({ salonId: "salon-a", firebaseUid: "uid-b", name: "Other", points: 99 });
    await updateWebCustomerName.run(
      request("uid-a", { uid: "uid-b", customerId: other.id, phone: "0999999999", points: 1000 }),
    );
    expect((await other.get()).data()).toMatchObject({ name: "Other", points: 99 });
    expect((await customerRef.get()).data()).toMatchObject({
      name: "Anh Minh",
      points: 7,
      phone: "0901234567",
    });
  });
  it("does not follow cross-tenant pointers or alter another salon's own profile", async () => {
    const other = db.doc(`customers/${customerIdForWeb("salon-b", "uid-a")}`);
    await other.set({ salonId: "salon-b", firebaseUid: "uid-a", name: "Salon B" });
    await customerRef.update({ activeSessionId: "cross-tenant" });
    await db.doc("point_requests/cross-tenant").set({
      salonId: "salon-b",
      customerId: other.id,
      status: "pending",
      customerSummary: { name: "Salon B" },
    });
    await updateWebCustomerName.run(request());
    expect((await other.get()).data()?.name).toBe("Salon B");
    expect((await db.doc("point_requests/cross-tenant").get()).data()?.customerSummary.name).toBe(
      "Salon B",
    );
  });
  it("never rewrites a completed request summary", async () => {
    await db.doc("point_requests/session-a").update({ status: "approved" });
    await db.doc("chair_sessions/session-a").update({ status: "completed" });
    await updateWebCustomerName.run(request());
    expect((await db.doc("point_requests/session-a").get()).data()?.customerSummary.name).toBe(
      "Khách 4567",
    );
    expect((await db.doc("chair_sessions/session-a").get()).data()?.customerSummary.name).toBe(
      "Khách 4567",
    );
  });
  it("rejects stale edits, while a repeated already-saved name is a no-op", async () => {
    await customerRef.update({ name: "Newer" });
    await expect(updateWebCustomerName.run(request())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await updateWebCustomerName.run(request("uid-a", { name: "Newer" }));
    expect((await db.collection("audit_events").get()).size).toBe(0);
  });
  for (const name of ["", " ", 123, "x".repeat(81), "Bad\u0000name"])
    it(`rejects invalid input ${JSON.stringify(name)}`, async () => {
      await expect(updateWebCustomerName.run(request("uid-a", { name }))).rejects.toMatchObject({
        code: "invalid-argument",
      });
      expect((await customerRef.get()).data()?.name).toBe("Khách 4567");
    });
  it("requires an authenticated Phone Auth principal", async () => {
    await expect(updateWebCustomerName.run(request(null))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(updateWebCustomerName.run(request("uid-a", {}, "password"))).rejects.toMatchObject(
      { code: "unauthenticated" },
    );
  });
  it("rejects absent or mismatched owned profiles instead of creating/linking a customer", async () => {
    await expect(updateWebCustomerName.run(request("uid-b"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await customerRef.update({ firebaseUid: "uid-b" });
    await expect(updateWebCustomerName.run(request())).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect((await db.collection("customers").get()).size).toBe(1);
  });
  it("rejects a disabled salon", async () => {
    await db.doc("salons/salon-a").update({ isActive: false });
    await expect(updateWebCustomerName.run(request())).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
  it("enforces a named per-UID/per-salon quota", async () => {
    const start = Math.floor(Date.now() / 60000) * 60000;
    for (const window of [start - 60000, start, start + 60000]) {
      const key = createHash("sha256")
        .update(`updateWebCustomerName:uid-a:salon-a:${window}`)
        .digest("hex");
      await db.doc(`_authenticated_rate_limits/${key}`).set({ count: 1000 });
    }
    await expect(updateWebCustomerName.run(request())).rejects.toMatchObject({
      code: "resource-exhausted",
    });
  });
});
