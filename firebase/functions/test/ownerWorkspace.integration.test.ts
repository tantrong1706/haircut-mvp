import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { searchSalonCustomers, updatePendingPointRequestPhotos } from "../src/index";
import { requireFirestoreEmulator, requireRulesEmulators } from "./emulatorEnvironment";
requireRulesEmulators();
const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const call = (uid: string, data: Record<string, unknown>) => ({ auth: { uid, token: {} }, data }) as never;
const existingPhoto = "https://firebasestorage.googleapis.com/v0/b/demo-haircut.appspot.com/o/" + encodeURIComponent("salons/salon-owner-test/customers/customer-0/haircuts/session-note/photo-fixture12345.jpg");

describe("owner directory and pending visit notes", () => {
  beforeEach(async () => {
    const response = await fetch(`http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
    if (!response.ok) throw new Error("Demo fixture reset failed");
    await Promise.all([
      db.doc("salons/salon-owner-test").set({ isActive: true, status: "active", pointPerVisit: 1 }),
      db.doc("branches/branch-note").set({ salonId: "salon-owner-test", isActive: true }),
      db.doc("users/owner-note").set({ salonId: "salon-owner-test", isActive: true, role: "owner", name: "Owner fixture" }),
      db.doc("users/staff-note").set({ salonId: "salon-owner-test", isActive: true, role: "staff", branchIds: ["branch-note"] }),
      db.doc("users/staff-other").set({ salonId: "salon-owner-test", isActive: true, role: "staff", branchIds: ["other-branch"] }),
      ...Array.from({ length: 6 }, (_, i) => db.doc(`customers/customer-${i}`).set({ salonId: "salon-owner-test", name: `Customer ${i}`, phoneLast4: "5678", points: i, allowPhoto: true })),
      db.doc("customers/foreign-customer").set({ salonId: "other-salon", name: "Foreign", phoneLast4: "5678", points: 99 }),
      db.doc("chair_sessions/session-note").set({ salonId: "salon-owner-test", branchId: "branch-note", customerId: "customer-0", status: "pending_approval", approvalMode: "staff_confirmation", expiresAt: Timestamp.fromMillis(Date.now() + 600_000) }),
      db.doc("point_requests/request-note").set({ salonId: "salon-owner-test", branchId: "branch-note", customerId: "customer-0", sessionId: "session-note", status: "pending", approvalMode: "staff_confirmation", note: "Old note", photoUrls: [existingPhoto], photoPaths: [], pointsRequested: 1 }),
    ]);
  });
  afterAll(async () => { await Promise.all(getApps().map(deleteApp)); });

  it("lists the owner's customers on first open with accurate count and bounded pages", async () => {
    const first = await searchSalonCustomers.run(call("owner-note", { salonId: "salon-owner-test", directory: true, pageSize: 5 }));
    expect(first.customers).toHaveLength(5);
    expect(first).toMatchObject({ totalCount: 6 });
    const second = await searchSalonCustomers.run(call("owner-note", { salonId: "salon-owner-test", directory: true, pageSize: 5, cursor: first.nextCursor }));
    expect(second.customers).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.customers, ...second.customers].map(customer => customer.id);
    expect(new Set(ids).size).toBe(6);
    expect(ids).not.toContain("foreign-customer");
  });
  it("does not grant a whole customer directory to staff or another tenant", async () => {
    await expect(searchSalonCustomers.run(call("staff-note", { salonId: "salon-owner-test", directory: true }))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(searchSalonCustomers.run(call("owner-note", { salonId: "other-salon", directory: true }))).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("rejects foreign pagination cursors and preserves normal phone search", async () => {
    await expect(searchSalonCustomers.run(call("owner-note", { salonId: "salon-owner-test", directory: true, cursor: "foreign-customer" }))).rejects.toMatchObject({ code: "invalid-argument" });
    const result = await searchSalonCustomers.run(call("staff-note", { salonId: "salon-owner-test", branchId: "branch-note", term: "5678" }));
    expect(result.customers).toHaveLength(6);
    expect(result.customers[0]).not.toHaveProperty("phone");
  });
  it("saves a text note without requiring photo consent or changing photos and points", async () => {
    await updatePendingPointRequestPhotos.run(call("owner-note", { salonId: "salon-owner-test", requestId: "request-note", note: "Giữ form tóc" }));
    expect((await db.doc("point_requests/request-note").get()).data()).toMatchObject({ note: "Giữ form tóc", photoUrls: [existingPhoto], photoPaths: [], status: "pending", pointsRequested: 1 });
    expect((await db.doc("chair_sessions/session-note").get()).data()).toMatchObject({ note: "Giữ form tóc", status: "pending_approval" });
    expect((await db.doc("customers/customer-0").get()).data()?.points).toBe(0);
    expect((await db.collection("haircut_records").get()).size).toBe(0);
  });
  it("preserves all saved photos when only the note changes with photo consent present", async () => {
    await db.doc("chair_sessions/session-note").update({ photoConsentGranted: true });
    await updatePendingPointRequestPhotos.run(call("owner-note", { salonId: "salon-owner-test", requestId: "request-note", note: "New note" }));
    expect((await db.doc("point_requests/request-note").get()).data()).toMatchObject({ photoUrls: [existingPhoto], note: "New note" });
  });
  it("rejects an expired request, an inactive actor and excessive note length", async () => {
    const data = { salonId: "salon-owner-test", requestId: "request-note", note: "Text only" };
    await db.doc("users/staff-note").update({ isActive: false });
    await expect(updatePendingPointRequestPhotos.run(call("staff-note", data))).rejects.toMatchObject({ code: "permission-denied" });
    await expect(updatePendingPointRequestPhotos.run(call("owner-note", { ...data, note: "x".repeat(1001) }))).rejects.toMatchObject({ code: "invalid-argument" });
    await db.doc("chair_sessions/session-note").update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(updatePendingPointRequestPhotos.run(call("owner-note", data))).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("lets assigned branch staff save notes but rejects other branches", async () => {
    const data = { salonId: "salon-owner-test", requestId: "request-note", note: "Ghi chú nhân viên" };
    await expect(updatePendingPointRequestPhotos.run(call("staff-other", data))).rejects.toMatchObject({ code: "permission-denied" });
    await updatePendingPointRequestPhotos.run(call("staff-note", data));
    expect((await db.doc("point_requests/request-note").get()).data()).toMatchObject({ note: data.note, photoUrls: [existingPhoto] });
  });
  it("does not permit note changes after the visit has been processed", async () => {
    await db.doc("point_requests/request-note").update({ status: "approved" });
    await expect(updatePendingPointRequestPhotos.run(call("owner-note", { salonId: "salon-owner-test", requestId: "request-note", note: "Too late" }))).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.doc("point_requests/request-note").get()).data()?.note).toBe("Old note");
  });
});
