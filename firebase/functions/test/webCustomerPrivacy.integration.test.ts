import { deleteApp, getApps } from "firebase-admin/app";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInWebCustomer, withdrawWebCustomerPhotoConsent } from "../src/index";
import { customerIdForWeb } from "../src/customerWebIdentity";
import { createSignedQrToken } from "../src/security";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();

function request(uid: string | null, data: Record<string, unknown>, provider = "phone") {
  return {
    data,
    auth: uid
      ? { uid, token: { phone_number: "+84901234567", firebase: { sign_in_provider: provider } } }
      : undefined,
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
async function customer(salonId: string, uid: string, boundUid = uid) {
  const ref = db.doc(`customers/${customerIdForWeb(salonId, uid)}`);
  await ref.set({ salonId, firebaseUid: boundUid, allowPhoto: true, points: 7 });
  return ref;
}

describe("customer withdrawal of photo permission", () => {
  it("enforces a named authenticated rate limit for withdrawal", async () => {
    await customer("salon-a", "uid-a");
    const start = Math.floor(Date.now() / 60_000) * 60_000;
    for (const window of [start - 60_000, start, start + 60_000]) {
      const id = createHash("sha256")
        .update(`withdrawWebCustomerPhotoConsent:uid-a:salon-a:${window}`)
        .digest("hex");
      await db.doc(`_authenticated_rate_limits/${id}`).set({ count: 1000 });
    }
    await expect(
      withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" })),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });
  it("does not create a customer when no owned profile exists", async () => {
    await expect(
      withdrawWebCustomerPhotoConsent.run(request("missing-uid", { salonId: "salon-a" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect((await db.collection("customers").get()).size).toBe(0);
  });
  it("ignores malformed session pointers while still withdrawing the owned permission", async () => {
    const ref = await customer("salon-a", "uid-a");
    await ref.update({ activeSessionId: "../not-a-session" });
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    expect((await ref.get()).data()?.allowPhoto).toBe(false);
  });
  it("never mutates another tenant or customer's records through a corrupt pointer", async () => {
    const ref = await customer("salon-a", "uid-a");
    await ref.update({ activeSessionId: "other-session" });
    const chair = db.doc("chair_sessions/other-session");
    const point = db.doc("point_requests/other-session");
    await chair.set({
      salonId: "salon-b",
      customerId: "other-customer",
      status: "pending_approval",
      photoConsentGranted: true,
    });
    await point.set({
      salonId: "salon-a",
      customerId: "other-customer",
      status: "pending",
      photoConsentGranted: true,
    });
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    expect((await chair.get()).data()?.photoConsentGranted).toBe(true);
    expect((await point.get()).data()?.photoConsentGranted).toBe(true);
  });
  it("does not rewrite completed service records or fail when a related request is absent", async () => {
    const ref = await customer("salon-a", "uid-a");
    await ref.update({ activeSessionId: "finished-session" });
    const chair = db.doc("chair_sessions/finished-session");
    await chair.set({
      salonId: "salon-a",
      customerId: ref.id,
      status: "completed",
      photoConsentGranted: true,
    });
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    expect((await chair.get()).data()?.photoConsentGranted).toBe(true);
    expect((await ref.get()).data()?.allowPhoto).toBe(false);
  });
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Emulator reset failed");
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("removes pending photo references without blocking points or rewriting completed history", async () => {
    const secret = "fixture-privacy-signing-key-not-production";
    vi.stubEnv("QR_SIGNING_SECRET", secret);
    await db.doc("salons/salon-a").set({
      name: "Fixture",
      isActive: true,
      status: "active",
      plan: "pro",
      pointPerVisit: 1,
      customerCount: 0,
    });
    await db
      .doc("branches/branch-a")
      .set({ salonId: "salon-a", name: "Fixture branch", isActive: true, qrVersion: 1 });
    const checked = await checkInWebCustomer.run(
      request("uid-a", {
        qrType: "branch",
        salonId: "salon-a",
        branchId: "branch-a",
        allowPhoto: true,
        qrToken: createSignedQrToken(secret, {
          kind: "branch",
          salonId: "salon-a",
          branchId: "branch-a",
          version: 1,
        }),
      }),
    );
    const pending = db.doc(`point_requests/${checked.sessionId}`);
    const chair = db.doc(`chair_sessions/${checked.sessionId}`);
    await pending.update({
      photoUrls: ["https://example.invalid/fixture.jpg"],
      photoPaths: ["fixture-private-path"],
    });
    await db.doc("haircut_records/completed-fixture").set({
      salonId: "salon-a",
      customerId: checked.customer.customerId,
      photoConsentGranted: true,
      pointsAdded: 1,
    });
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    expect((await pending.get()).data()).toMatchObject({
      status: "pending",
      pointsRequested: 1,
      photoConsentGranted: false,
      customerSummary: { allowPhoto: false },
      photoUrls: [],
      photoPaths: [],
    });
    expect((await chair.get()).data()?.photoConsentGranted).toBe(false);
    expect((await db.doc("haircut_records/completed-fixture").get()).data()).toMatchObject({
      photoConsentGranted: true,
      pointsAdded: 1,
    });
  });

  it.each([null, "email-user"])("rejects missing or non-Phone authentication: %s", async (uid) => {
    await expect(
      withdrawWebCustomerPhotoConsent.run(request(uid, { salonId: "salon-a" }, "password")),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
  it("derives identity server-side and cannot affect another customer or salon", async () => {
    const own = await customer("salon-a", "uid-a");
    const other = await customer("salon-a", "uid-b");
    const otherSalon = await customer("salon-b", "uid-a");
    const result = await withdrawWebCustomerPhotoConsent.run(
      request("uid-a", {
        salonId: "salon-a",
        customerId: other.id,
        firebaseUid: "uid-b",
        allowPhoto: true,
      }),
    );
    expect(result).toMatchObject({ allowPhoto: false });
    expect((await own.get()).data()).toMatchObject({ allowPhoto: false, points: 7 });
    expect((await other.get()).data()?.allowPhoto).toBe(true);
    expect((await otherSalon.get()).data()?.allowPhoto).toBe(true);
    expect((await db.collection("haircut_records").get()).size).toBe(0);
    expect((await db.collection("point_requests").get()).size).toBe(0);
  });
  it("rejects a corrupt account binding without creating or changing a profile", async () => {
    const ref = await customer("salon-a", "uid-a", "uid-other");
    await expect(
      withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect((await ref.get()).data()?.allowPhoto).toBe(true);
  });
  it("is idempotent and remains available when a salon is suspended", async () => {
    const ref = await customer("salon-a", "uid-a");
    await db.doc("salons/salon-a").set({ status: "suspended", isActive: false });
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    await withdrawWebCustomerPhotoConsent.run(request("uid-a", { salonId: "salon-a" }));
    expect((await ref.get()).data()).toMatchObject({ allowPhoto: false, points: 7 });
  });
});
