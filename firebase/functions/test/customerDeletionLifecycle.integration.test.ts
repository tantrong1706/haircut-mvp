import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

// This case tests Firestore lifecycle/idempotency; no objects are present in Storage.
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ getFiles: async () => [[], null] }) }),
}));
import { deleteCustomerData } from "../src/index";
const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const oldVersion = 1_700_000_000_000;
const newVersion = oldVersion + 1000;
const input = (expectedCreatedAtMs: number) =>
  ({
    data: { salonId: "deletion-salon", customerId: "returning-customer", expectedCreatedAtMs },
    auth: { uid: "deletion-owner", token: {} },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  }) as never;

describe("explicit deletion after a customer returns", () => {
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Emulator reset failed");
    await db
      .doc("users/deletion-owner")
      .set({ salonId: "deletion-salon", role: "owner", isActive: true });
    await db.doc("salons/deletion-salon").set({
      name: "Deletion fixture",
      ownerUid: "deletion-owner",
      ownerId: "deletion-owner",
      isActive: true,
      status: "active",
      customerCount: 1,
    });
  });
  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("does not reuse a completed result as proof that a recreated profile was deleted", async () => {
    const customer = db.doc("customers/returning-customer");
    await customer.set({
      salonId: "deletion-salon",
      firebaseUid: "returning-uid",
      points: 2,
      createdAt: Timestamp.fromMillis(oldVersion),
    });
    await db
      .doc("haircut_records/old-record")
      .set({ salonId: "deletion-salon", customerId: customer.id, createdAt: Timestamp.now() });
    const first = await deleteCustomerData.run(input(oldVersion));
    expect(first.status).toBe("completed");
    expect((await customer.get()).exists).toBe(false);

    // The same authenticated customer can join this salon again later.
    await customer.set({
      salonId: "deletion-salon",
      firebaseUid: "returning-uid",
      points: 1,
      createdAt: Timestamp.fromMillis(newVersion),
    });
    await db.doc("salons/deletion-salon").update({ customerCount: 1 });
    await db
      .doc("haircut_records/new-record")
      .set({ salonId: "deletion-salon", customerId: customer.id, createdAt: Timestamp.now() });
    const second = await deleteCustomerData.run(input(newVersion));
    expect(second.status).toBe("completed");
    expect((await customer.get()).exists).toBe(false);
    expect((await db.doc("haircut_records/new-record").get()).exists).toBe(false);
    expect((await db.doc("salons/deletion-salon").get()).data()?.customerCount).toBe(0);
    expect(await deleteCustomerData.run(input(newVersion))).toEqual(second);
  });
  it("rejects a delayed retry of the previous profile instead of deleting a new profile", async () => {
    const customer = db.doc("customers/returning-customer");
    await customer.set({
      salonId: "deletion-salon",
      points: 2,
      createdAt: Timestamp.fromMillis(oldVersion),
    });
    await deleteCustomerData.run(input(oldVersion));
    await customer.set({
      salonId: "deletion-salon",
      points: 1,
      createdAt: Timestamp.fromMillis(newVersion),
    });
    await db.doc("salons/deletion-salon").update({ customerCount: 1 });
    await expect(deleteCustomerData.run(input(oldVersion))).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect((await customer.get()).data()?.points).toBe(1);
  });
});
