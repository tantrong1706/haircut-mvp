import { deleteApp, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approvePointRequest,
  checkInWebCustomer,
  getWebCustomerContext,
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSession,
  getSalonProfile,
  listBranches,
  spinWebLuckyWheel,
  resolveCustomerQr,
  updateSalonProfile,
} from "../src/index";
import { createSignedQrToken } from "../src/security";
import * as privatePhotos from "../src/domains/photos/privatePhotoAccess";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const secret = "fixture-qr-signing-key-only-32-characters";

describe("authenticated web customer platform", () => {
  it("uses the current address for directions in an existing visit and suppresses a closed branch", async () => {
    await seedSalon("salon-a", "branch-a");
    await db.doc("salons/salon-a").update({ showDirections: true });
    const qr = signedBranchQr("salon-a", "branch-a");
    const uid = "uid-current-directions";
    const checked = await checkInWebCustomer.run(checkinRequest(uid, qr));
    expect(checked).toMatchObject({ branchAddress: "1 Đường A", branchDirectionsEnabled: true });
    const sessionInput = { salonId: "salon-a", sessionId: checked.sessionId };
    await db.doc("branches/branch-a").update({ address: "Địa chỉ chi nhánh mới" });
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).activeSession).toMatchObject({
      branchAddress: "Địa chỉ chi nhánh mới",
      branchDirectionsEnabled: true,
    });
    await expect(getWebCustomerSession.run(phoneRequest(uid, sessionInput))).resolves.toMatchObject(
      { branchAddress: "Địa chỉ chi nhánh mới", branchDirectionsEnabled: true },
    );
    await db.doc("branches/branch-a").update({ isActive: false });
    await expect(getWebCustomerSession.run(phoneRequest(uid, sessionInput))).resolves.toMatchObject(
      { branchAddress: "", branchDirectionsEnabled: false, sessionStatus: "pending_approval" },
    );
  });

  it("enforces owner location and operation settings without changing existing requests or overriding admin", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedSalon("salon-b", "branch-b");
    await db.doc("users/owner-a").set({ salonId: "salon-a", role: "owner", isActive: true });
    const qr = signedBranchQr("salon-a", "branch-a");
    const owner = { salonId: "salon-a", name: "Salon A", pointPerVisit: 1 };
    const set = (fields: Record<string, unknown>) =>
      updateSalonProfile.run(requestFor("owner-a", { ...owner, ...fields }, {}));
    const uid = "uid-owner-pause";
    const existing = await checkInWebCustomer.run(checkinRequest(uid, qr));
    const customer = db.doc(`customers/${existing.customer.customerId}`);
    await customer.update({ points: 8 });
    await set({
      showBranchAddress: false,
      showDirections: true,
      acceptWebPointRequests: false,
      allowWebWheel: false,
    });
    const context = await getWebCustomerContext.run(phoneRequest(uid, qr));
    expect(context.qr).toMatchObject({
      branchAddress: "",
      branchDirectionsEnabled: false,
      acceptingPointRequests: false,
    });
    expect(context.activeSession).toMatchObject({
      sessionId: existing.sessionId,
      branchAddress: "",
      features: { checkinEnabled: false, luckyWheelEnabled: false },
    });
    const publicQr = await resolveCustomerQr.run(requestFor("", qr, {}));
    expect(publicQr.branchAddress).toBe("");
    expect(publicQr.branches[0].address).toBe("");
    await expect(
      getWebCustomerSession.run(
        phoneRequest(uid, { salonId: "salon-a", sessionId: existing.sessionId }),
      ),
    ).resolves.toMatchObject({ branchAddress: "", features: { luckyWheelEnabled: false } });
    await expect(checkInWebCustomer.run(checkinRequest("uid-pause-new", qr))).rejects.toMatchObject(
      { code: "failed-precondition", details: { feature: "checkinEnabled" } },
    );
    await expect(
      spinWebLuckyWheel.run(
        phoneRequest(uid, {
          salonId: "salon-a",
          configVersion: 1,
          idempotencyKey: "fixture-paused-spin",
        }),
      ),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { feature: "luckyWheelEnabled" },
    });
    expect((await db.collection("point_requests").get()).size).toBe(1);
    expect((await customer.get()).data()?.points).toBe(8);
    expect((await db.collection("reward_history").get()).empty).toBe(true);
    expect((await db.doc("branches/branch-a").get()).data()?.address).toBe("1 Đường A");
    await db.doc("users/staff-pause").set({
      salonId: "salon-a",
      role: "staff",
      isActive: true,
      branchIds: ["branch-a"],
    });
    await approvePointRequest.run(
      requestFor("staff-pause", { salonId: "salon-a", requestId: existing.sessionId }, {}),
    );
    expect((await customer.get()).data()?.points).toBe(9);
    await expect(
      checkInWebCustomer.run(
        checkinRequest("uid-other-salon", signedBranchQr("salon-b", "branch-b")),
      ),
    ).resolves.toMatchObject({ sessionStatus: "pending_approval" });
    await db.doc("system_config/features").set({ luckyWheelEnabled: false });
    await set({ showBranchAddress: true, acceptWebPointRequests: true, allowWebWheel: true });
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).qr).toMatchObject({
      branchAddress: "1 Đường A",
      branchDirectionsEnabled: true,
      acceptingPointRequests: true,
    });
    await expect(
      spinWebLuckyWheel.run(
        phoneRequest(uid, {
          salonId: "salon-a",
          configVersion: 1,
          idempotencyKey: "fixture-admin-pause",
        }),
      ),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { feature: "luckyWheelEnabled" },
    });
    await expect(
      checkInWebCustomer.run(checkinRequest("uid-pause-new", qr)),
    ).resolves.toMatchObject({ sessionStatus: "pending_approval" });
  });

  it("hides only opted-out public fields without deleting their values", async () => {
    await seedSalon("salon-a", "branch-a");
    await db.doc("users/owner-a").set({ salonId: "salon-a", role: "owner", isActive: true });
    await db.doc("users/staff-a").set({ salonId: "salon-a", role: "staff", isActive: true });
    const bucket = getStorage().bucket().name;
    const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/salons%2Fsalon-a%2Fbranding%2Favatar.webp?alt=media`;
    const saved = { avatarUrl, hotline: "028 0000 0000", openingHours: "09:00–20:00" };
    await db.doc("salons/salon-a").update({ name: "Salon A", ...saved });
    const qr = signedBranchQr("salon-a", "branch-a");
    const uid = "uid-contact-visibility";
    const ownerProfile = { salonId: "salon-a", name: "Salon A", pointPerVisit: 1 };
    const visible = {
      salonName: "Salon A",
      salonAvatarUrl: avatarUrl,
      salonHotline: saved.hotline,
      salonOpeningHours: saved.openingHours,
    };
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).qr).toMatchObject(visible);
    const allHidden = { showLogo: false, showHotline: false, showOpeningHours: false };
    await expect(
      updateSalonProfile.run(requestFor("staff-a", { ...ownerProfile, ...allHidden }, {})),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updateSalonProfile.run(requestFor("owner-a", { ...ownerProfile, showLogo: "false" }, {})),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      updateSalonProfile.run(requestFor("owner-a", { ...ownerProfile, ...allHidden }, {})),
    ).resolves.toMatchObject({ ...saved, ...allHidden });
    await updateSalonProfile.run(requestFor("owner-a", ownerProfile, {}));
    await expect(
      getSalonProfile.run(requestFor("owner-a", { salonId: "salon-a" }, {})),
    ).resolves.toMatchObject({ ...saved, ...allHidden });
    const hidden = {
      salonName: "Salon A",
      salonAvatarUrl: "",
      salonHotline: "",
      salonOpeningHours: "",
    };
    await expect(resolveCustomerQr.run(requestFor("", qr, {}))).resolves.toMatchObject(hidden);
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).qr).toMatchObject(hidden);
    await expect(checkInWebCustomer.run(checkinRequest(uid, qr))).resolves.toMatchObject(hidden);
    await expect(
      getWebCustomerSession.run(phoneRequest(uid, { salonId: "salon-a" })),
    ).resolves.toMatchObject(hidden);
    await updateSalonProfile.run(requestFor("owner-a", { ...ownerProfile, showHotline: true }, {}));
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).qr).toMatchObject({
      ...hidden,
      salonHotline: saved.hotline,
    });
    await updateSalonProfile.run(
      requestFor("owner-a", { ...ownerProfile, showLogo: true, showOpeningHours: true }, {}),
    );
    expect((await getWebCustomerContext.run(phoneRequest(uid, qr))).qr).toMatchObject(visible);
  });

  it("publishes only explicitly set salon contact details and keeps them across older client edits", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedSalon("salon-b", "branch-b");
    await db.doc("users/owner-a").set({ salonId: "salon-a", role: "owner", isActive: true });
    await db.doc("users/staff-a").set({ salonId: "salon-a", role: "staff", isActive: true });
    const base = { salonId: "salon-a", name: "Salon A", phone: "0900000000", pointPerVisit: 1 };
    const contact = { hotline: "028 0000 0000", openingHours: "Thứ 2–CN, 09:00–20:00" };
    const update = { ...base, ...contact };
    await expect(updateSalonProfile.run(requestFor("staff-a", update, {}))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(
      updateSalonProfile.run(requestFor("owner-a", { ...update, salonId: "salon-b" }, {})),
    ).rejects.toMatchObject({ code: "permission-denied" });
    const qr = signedBranchQr("salon-a", "branch-a");
    await updateSalonProfile.run(requestFor("owner-a", base, {}));
    const before = await getWebCustomerContext.run(phoneRequest("uid-salon-contact", qr));
    expect(before.qr).toMatchObject({ salonHotline: "", salonOpeningHours: "" });
    expect(JSON.stringify(before)).not.toContain(base.phone);
    await expect(
      updateSalonProfile.run(
        requestFor("owner-a", { ...update, hotline: "javascript:alert(1)" }, {}),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      updateSalonProfile.run(
        requestFor("owner-a", { ...update, openingHours: "x".repeat(161) }, {}),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(updateSalonProfile.run(requestFor("owner-a", update, {}))).resolves.toMatchObject(
      contact,
    );
    await updateSalonProfile.run(requestFor("owner-a", { ...base, name: "Salon A mới" }, {}));
    await expect(
      getSalonProfile.run(requestFor("owner-a", { salonId: "salon-a" }, {})),
    ).resolves.toMatchObject({ ...contact, name: "Salon A mới" });
    const publicFields = {
      salonName: "Salon A mới",
      salonHotline: contact.hotline,
      salonOpeningHours: contact.openingHours,
    };
    const visible = await getWebCustomerContext.run(phoneRequest("uid-salon-contact", qr));
    expect(visible.qr).toMatchObject(publicFields);
    expect(JSON.stringify(visible)).not.toContain(base.phone);
    await expect(
      checkInWebCustomer.run(checkinRequest("uid-salon-contact", qr)),
    ).resolves.toMatchObject(publicFields);
    await expect(
      getWebCustomerSession.run(phoneRequest("uid-salon-contact", { salonId: "salon-a" })),
    ).resolves.toMatchObject(publicFields);
    await updateSalonProfile.run(
      requestFor("owner-a", { ...base, hotline: "", openingHours: "" }, {}),
    );
    const cleared = await getWebCustomerContext.run(phoneRequest("uid-salon-contact", qr));
    expect(cleared.qr).toMatchObject({ salonHotline: "", salonOpeningHours: "" });
    expect(JSON.stringify(cleared)).not.toContain(base.phone);
  });

  it.each([undefined, false, null, "true"])(
    "blocks a new request without explicit photo consent (%s)",
    async (allowPhoto) => {
      await seedSalon("salon-a", "branch-a");
      const qr = signedBranchQr("salon-a", "branch-a");
      await expect(
        checkInWebCustomer.run(
          phoneRequest("uid-photo-required", {
            ...qr,
            ...(allowPhoto === undefined ? {} : { allowPhoto }),
          }),
        ),
      ).rejects.toMatchObject({
        code: "failed-precondition",
        details: { errorCode: "PHOTO_CONSENT_REQUIRED" },
      });
      expect((await db.collection("point_requests").get()).empty).toBe(true);
      expect((await db.collection("chair_sessions").get()).empty).toBe(true);
      expect((await db.collection("customers").get()).empty).toBe(true);
    },
  );
  it("keeps a 2-hour Web confirmation window without awarding points automatically", async () => {
    await seedSalon("salon-a", "branch-a");
    const checked = await checkInWebCustomer.run(
      checkinRequest("uid-long-service", signedBranchQr("salon-a", "branch-a")),
    );
    const point = (await db.doc(`point_requests/${checked.sessionId}`).get()).data()!;
    const chair = (await db.doc(`chair_sessions/${checked.sessionId}`).get()).data()!;
    expect(point.expiresAt.toMillis() - point.createdAt.toMillis()).toBe(2 * 60 * 60_000);
    expect(chair.expiresAt.toMillis()).toBe(point.expiresAt.toMillis());
    expect(point.status).toBe("pending");
    expect(await contextPoints(checked.customer.customerId)).toBe(0);
    expect((await db.collection("haircut_records").get()).size).toBe(0);
  });

  it("confirms a 31-minute-old request inside its original 2-hour window, keeping cooldown", async () => {
    await seedSalon("salon-a", "branch-a");
    await db
      .doc("users/staff-a")
      .set({ salonId: "salon-a", role: "staff", isActive: true, branchIds: ["branch-a"] });
    const qr = signedBranchQr("salon-a", "branch-a");
    const checked = await checkInWebCustomer.run(checkinRequest("uid-long-service", qr));
    const pointRef = db.doc(`point_requests/${checked.sessionId}`);
    const point = (await pointRef.get()).data()!;
    const shifted = {
      createdAt: Timestamp.fromMillis(point.createdAt.toMillis() - 31 * 60_000),
      expiresAt: Timestamp.fromMillis(point.expiresAt.toMillis() - 31 * 60_000),
    };
    await pointRef.update(shifted);
    await db.doc(`chair_sessions/${checked.sessionId}`).update(shifted);
    await approvePointRequest.run(
      requestFor("staff-a", { salonId: "salon-a", requestId: checked.sessionId }, {}),
    );
    expect(await contextPoints(checked.customer.customerId)).toBe(1);
    expect((await db.collection("haircut_records").get()).size).toBe(1);
    await expect(
      checkInWebCustomer.run(checkinRequest("uid-long-service", qr)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("records explicit consent for the new request without requiring an uploaded photo", async () => {
    await seedSalon("salon-a", "branch-a");
    const checked = await checkInWebCustomer.run(
      checkinRequest("uid-photo-consented", signedBranchQr("salon-a", "branch-a")),
    );
    expect(checked.customer.allowPhoto).toBe(true);
    const point = (await db.doc(`point_requests/${checked.sessionId}`).get()).data();
    expect(point).toMatchObject({
      status: "pending",
      photoConsentGranted: true,
      photoConsentVersion: "web-checkin-v3",
      photoPaths: [],
    });
    expect((await db.doc(`chair_sessions/${checked.sessionId}`).get()).data()).toMatchObject({
      photoConsentGranted: true,
      photoConsentVersion: "web-checkin-v3",
    });
  });

  beforeEach(async () => {
    vi.stubEnv("QR_SIGNING_SECRET", secret);
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error(`Không xóa được emulator: HTTP ${response.status}`);
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("customer history never returns internal notes, storage paths or legacy image URLs", async () => {
    await seedSalon("salon-a", "branch-a");
    const context = await getWebCustomerContext.run(
      phoneRequest("uid-private", signedBranchQr("salon-a", "branch-a")),
    );
    await db.doc(`customers/${context.customer.customerId}`).update({ allowPhoto: true });
    await db.doc("haircut_records/private-record").set({
      salonId: "salon-a",
      customerId: context.customer.customerId,
      branchId: "branch-a",
      createdAt: Timestamp.now(),
      pointsAdded: 1,
      note: "Synthetic internal formula",
      photoUrls: ["https://example.invalid/salon-private.jpg"],
      photoPaths: [],
    });
    const history = await getWebCustomerHistory.run(
      phoneRequest("uid-private", { salonId: "salon-a" }),
    );
    expect(history.records).toHaveLength(1);
    expect(history.records[0]).toMatchObject({ id: "private-record", pointsAdded: 1 });
    expect(history.records[0]).not.toHaveProperty("note");
    expect(history.records[0]).not.toHaveProperty("photoUrls");
    expect(history.records[0]).not.toHaveProperty("photoPaths");
    expect((await db.doc("haircut_records/private-record").get()).data()?.note).toBe(
      "Synthetic internal formula",
    );
  });

  it("only issues a temporary photo link to the authenticated customer for a consented completed visit", async () => {
    await seedSalon("salon-a", "branch-a");
    const qr = signedBranchQr("salon-a", "branch-a");
    const own = await checkInWebCustomer.run(checkinRequest("uid-photos", qr));
    const other = await getWebCustomerContext.run(phoneRequest("uid-other-photos", qr));
    const customerId = own.customer.customerId;
    const sessionId = own.sessionId;
    const path = `salons/salon-a/customers/${customerId}/sessions/${sessionId}/op-${"a".repeat(40)}.jpg`;
    const otherPath = path.replace(customerId, other.customer.customerId);
    const visit = db.doc("haircut_records/photo-visit");
    await db.doc(`chair_sessions/${sessionId}`).update({ status: "completed" });
    await db.doc(`point_requests/${sessionId}`).update({ status: "approved" });
    await visit.set({
      salonId: "salon-a",
      customerId,
      branchId: "branch-a",
      pointRequestId: sessionId,
      createdAt: Timestamp.now(),
      pointsAdded: 1,
      note: "Private formula",
      photoUrls: ["https://example.invalid/not-a-salon-photo.jpg"],
      photoPaths: [path, otherPath],
    });
    const link = "https://storage.googleapis.com/demo-haircut/fixture.jpg?X-Goog-Signature=fixture";
    const sign = vi.spyOn(privatePhotos, "privatePhotoUrl").mockResolvedValue(link);
    const request = { salonId: "salon-a", photoRecordId: visit.id };
    try {
      const list = await getWebCustomerHistory.run(
        phoneRequest("uid-photos", { salonId: "salon-a" }),
      );
      expect(list.records[0]).toMatchObject({ id: visit.id, hasCustomerPhotos: true });
      expect(list.records[0]).not.toHaveProperty("note");
      expect(list.records[0]).not.toHaveProperty("photoPaths");
      expect(sign).not.toHaveBeenCalled();
      await expect(
        getWebCustomerHistory.run(
          phoneRequest("uid-other-photos", {
            ...request,
            customerId,
          }),
        ),
      ).rejects.toMatchObject({ code: "not-found" });
      await expect(
        getWebCustomerHistory.run(
          phoneRequest("uid-photos", {
            ...request,
            salonId: "salon-b",
          }),
        ),
      ).rejects.toMatchObject({ code: "not-found" });
      await expect(getWebCustomerHistory.run(requestFor("", request, {}))).rejects.toMatchObject({
        code: "unauthenticated",
      });
      const photo = await getWebCustomerHistory.run(phoneRequest("uid-photos", request));
      expect(photo).toMatchObject({ records: [], customerPhotoUrls: [link] });
      expect(sign).toHaveBeenCalledExactlyOnceWith(expect.anything(), path, expect.any(Number));
      await db.doc(`customers/${customerId}`).update({ allowPhoto: false });
      await expect(
        getWebCustomerHistory.run(phoneRequest("uid-photos", request)),
      ).resolves.toMatchObject({ customerPhotoUrls: [] });
      await db.doc(`customers/${customerId}`).update({
        allowPhoto: true,
        photoConsentRevokedAt: Timestamp.fromMillis(Date.now() + 1000),
      });
      await expect(
        getWebCustomerHistory.run(phoneRequest("uid-photos", request)),
      ).resolves.toMatchObject({ customerPhotoUrls: [] });
      await db.doc(`customers/${customerId}`).update({ photoConsentRevokedAt: null });
      await db.doc(`chair_sessions/${sessionId}`).update({ photoConsentGranted: false });
      await expect(
        getWebCustomerHistory.run(phoneRequest("uid-photos", request)),
      ).resolves.toMatchObject({ customerPhotoUrls: [] });
      expect(sign).toHaveBeenCalledTimes(1);
    } finally {
      sign.mockRestore();
    }
  });

  it("cùng UID tạo profile riêng cho từng salon và retry không tạo trùng", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedSalon("salon-b", "branch-b");
    const qrA = signedBranchQr("salon-a", "branch-a");
    const qrB = signedBranchQr("salon-b", "branch-b");

    const firstA = await getWebCustomerContext.run(phoneRequest("uid-global", qrA));
    const retryA = await getWebCustomerContext.run(phoneRequest("uid-global", qrA));
    const firstB = await getWebCustomerContext.run(phoneRequest("uid-global", qrB));

    expect(retryA.customer.customerId).toBe(firstA.customer.customerId);
    expect(firstB.customer.customerId).not.toBe(firstA.customer.customerId);
    expect((await db.collection("customers").get()).size).toBe(2);
    expect((await db.collection("salons").doc("salon-a").get()).data()?.customerCount).toBe(1);
    expect((await db.collection("salons").doc("salon-b").get()).data()?.customerCount).toBe(1);

    await db.collection("customers").doc(firstA.customer.customerId).update({ points: 15 });
    await db.collection("customers").doc(firstB.customer.customerId).update({ points: 3 });
    await db.collection("reward_history").doc("reward-salon-a").set({
      salonId: "salon-a",
      customerId: firstA.customer.customerId,
      rewardName: "Quà riêng Salon A",
      rewardCode: "HC-SALON-A",
      status: "unused",
      createdAt: Timestamp.now(),
    });
    const refreshedA = await getWebCustomerContext.run(phoneRequest("uid-global", qrA));
    const refreshedB = await getWebCustomerContext.run(phoneRequest("uid-global", qrB));
    const salonBRewards = await getWebCustomerRewards.run(
      phoneRequest("uid-global", { salonId: "salon-b", limit: 20 }),
    );
    expect(refreshedA.customer.points).toBe(15);
    expect(refreshedB.customer.points).toBe(3);
    expect(salonBRewards.rewards).toEqual([]);
  });

  it("xác minh QR và Firebase Phone principal trước khi đọc tenant", async () => {
    await seedSalon("salon-a", "branch-a");
    const valid = signedBranchQr("salon-a", "branch-a");

    await expect(getWebCustomerContext.run(unauthenticatedRequest(valid))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(
      getWebCustomerContext.run(requestFor("uid-email", valid, { email: "user@example.com" })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(
      getWebCustomerContext.run(
        phoneRequest("uid-global", { ...valid, branchId: "branch-tampered" }),
      ),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/permission-denied|failed-precondition/),
    });

    await db.collection("branches").doc("branch-a").update({ isActive: false });
    await expect(
      getWebCustomerContext.run(phoneRequest("uid-global", valid)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("QR salon một chi nhánh mở web, còn salon nhiều chi nhánh yêu cầu QR branch", async () => {
    await seedSalon("salon-a", "branch-a");
    const salonQr = signedSalonQr("salon-a");
    const context = await getWebCustomerContext.run(phoneRequest("uid-global", salonQr));
    expect(context.qr).toMatchObject({ salonId: "salon-a", branchId: "branch-a" });

    await seedBranch("salon-a", "branch-b");
    await expect(
      getWebCustomerContext.run(phoneRequest("uid-global", salonQr)),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("QR do owner lấy được trỏ tới customer web HTTPS", async () => {
    await seedSalon("salon-a", "branch-a");
    await db.collection("users").doc("owner-a").set({
      salonId: "salon-a",
      role: "owner",
      isActive: true,
      branchIds: [],
    });

    const result = await listBranches.run(requestFor("owner-a", { salonId: "salon-a" }, {}));
    expect(result.salonQrUrl).toMatch(/^https:\/\/app\.chhaircutsalon\.cc\/checkin\?/u);
    expect(result.branches[0].qrUrl).toMatch(/^https:\/\/app\.chhaircutsalon\.cc\/checkin\?/u);
    expect(result.salonQrUrl).not.toContain("zalo.me");
  });

  it("double click và network retry chỉ tạo một yêu cầu chờ nhân viên xác nhận", async () => {
    await seedSalon("salon-a", "branch-a");
    const qr = signedBranchQr("salon-a", "branch-a");
    await getWebCustomerContext.run(phoneRequest("uid-global", qr));

    const [first, second] = await Promise.all([
      checkInWebCustomer.run(checkinRequest("uid-global", qr)),
      checkInWebCustomer.run(checkinRequest("uid-global", qr)),
    ]);
    const retry = await checkInWebCustomer.run(checkinRequest("uid-global", qr));

    expect(second.sessionId).toBe(first.sessionId);
    expect(retry.sessionId).toBe(first.sessionId);
    expect(first.sessionStatus).toBe("pending_approval");
    expect((await db.collection("chair_sessions").get()).size).toBe(1);
    expect((await db.collection("active_service_sessions").get()).size).toBe(1);
    const requests = await db.collection("point_requests").get();
    expect(requests.size).toBe(1);
    expect(requests.docs[0].data()).toMatchObject({
      sessionId: first.sessionId,
      approvalMode: "staff_confirmation",
      status: "pending",
    });
  });

  it("ba khách quét cùng QR đồng thời có yêu cầu và cooldown riêng", async () => {
    await seedSalon("salon-a", "branch-a");
    await db
      .collection("users")
      .doc("staff-a")
      .set({
        salonId: "salon-a",
        role: "staff",
        name: "Nhân viên A",
        isActive: true,
        branchIds: ["branch-a"],
        canAwardPointsDirectly: false,
      });
    const qr = signedBranchQr("salon-a", "branch-a");
    const visitors = [
      { uid: "uid-visitor-1", phone: "+84901110001" },
      { uid: "uid-visitor-2", phone: "+84901110002" },
      { uid: "uid-visitor-3", phone: "+84901110003" },
    ];

    const sessions = await Promise.all(
      visitors.map(({ uid, phone }) => checkInWebCustomer.run(checkinRequest(uid, qr, phone))),
    );
    expect(new Set(sessions.map((session) => session.sessionId)).size).toBe(3);
    expect(new Set(sessions.map((session) => session.customer.customerId)).size).toBe(3);
    expect(sessions.map((session) => session.sessionStatus)).toEqual([
      "pending_approval",
      "pending_approval",
      "pending_approval",
    ]);
    expect((await db.collection("customers").get()).size).toBe(3);
    expect((await db.collection("salons").doc("salon-a").get()).data()?.customerCount).toBe(3);
    expect((await db.collection("chair_sessions").get()).size).toBe(3);
    expect((await db.collection("active_service_sessions").get()).size).toBe(3);
    const requests = await db.collection("point_requests").get();
    expect(requests.size).toBe(3);
    for (const session of sessions) {
      expect(
        requests.docs.find((request) => request.id === session.sessionId)?.data(),
      ).toMatchObject({
        salonId: "salon-a",
        branchId: "branch-a",
        customerId: session.customer.customerId,
        status: "pending",
        approvalMode: "staff_confirmation",
      });
    }

    const firstRetry = await checkInWebCustomer.run(
      checkinRequest(visitors[0].uid, qr, visitors[0].phone),
    );
    expect(firstRetry.sessionId).toBe(sessions[0].sessionId);
    expect((await db.collection("point_requests").get()).size).toBe(3);

    for (const session of sessions) {
      await approvePointRequest.run(
        requestFor("staff-a", { salonId: "salon-a", requestId: session.sessionId }, {}),
      );
    }
    expect((await db.collection("haircut_records").get()).size).toBe(3);
    for (const session of sessions) {
      const customer = (
        await db.collection("customers").doc(session.customer.customerId).get()
      ).data();
      expect(customer?.points).toBe(1);
      expect(customer?.nextPointEligibleAt.toMillis()).toBeGreaterThan(Date.now());
    }
    await expect(
      checkInWebCustomer.run(checkinRequest(visitors[0].uid, qr, visitors[0].phone)),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "POINT_COOLDOWN" },
    });
  });

  it("staff xác nhận web trực tiếp một lần và khóa yêu cầu mới 2 giờ trong salon", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedBranch("salon-a", "branch-b");
    await db
      .collection("users")
      .doc("staff-a")
      .set({
        salonId: "salon-a",
        role: "staff",
        name: "Nhân viên A",
        isActive: true,
        branchIds: ["branch-a"],
        canAwardPointsDirectly: false,
      });
    const qr = signedBranchQr("salon-a", "branch-a");
    const checkedIn = await checkInWebCustomer.run(checkinRequest("uid-global", qr));
    const confirmation = requestFor(
      "staff-a",
      { salonId: "salon-a", requestId: checkedIn.sessionId },
      {},
    );
    await approvePointRequest.run(confirmation);
    await approvePointRequest.run(confirmation);
    const state = await getWebCustomerSession.run(
      phoneRequest("uid-global", {
        salonId: "salon-a",
        sessionId: checkedIn.sessionId,
      }),
    );
    expect(state.sessionStatus).toBe("completed");
    expect(state.customer.points).toBe(1);
    expect(state.customer.nextPointEligibleAtMs).toBeGreaterThan(Date.now() + 119 * 60_000);
    await expect(checkInWebCustomer.run(checkinRequest("uid-global", qr))).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "POINT_COOLDOWN" },
    });
    await expect(
      checkInWebCustomer.run(checkinRequest("uid-global", signedBranchQr("salon-a", "branch-b"))),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "POINT_COOLDOWN" },
    });
    expect((await db.collection("haircut_records").get()).size).toBe(1);
  });

  it("khách đã có hồ sơ xem tài khoản không cần QR và không tạo lượt mới", async () => {
    await seedSalon("salon-a", "branch-a");
    const profile = await getWebCustomerContext.run(
      phoneRequest("uid-global", signedBranchQr("salon-a", "branch-a")),
    );
    const account = await getWebCustomerSession.run(
      phoneRequest("uid-global", { salonId: "salon-a" }),
    );
    expect(account.sessionId).toBe("");
    expect(account.customer.customerId).toBe(profile.customer.customerId);
    expect((await db.collection("chair_sessions").get()).size).toBe(0);
    await expect(
      getWebCustomerSession.run(phoneRequest("uid-other", { salonId: "salon-a" })),
    ).rejects.toMatchObject({ code: "not-found" });
    await expect(
      getWebCustomerSession.run(unauthenticatedRequest({ salonId: "salon-a" })),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("QR salon không cho chọn branch không nằm trong chữ ký khi có nhiều chi nhánh", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedBranch("salon-a", "branch-b");
    await expect(
      getWebCustomerContext.run(
        phoneRequest("uid-global", {
          ...signedSalonQr("salon-a"),
          branchId: "branch-b",
        }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection("customers").get()).size).toBe(0);
  });

  it("không đổi branch khi đang có active session", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedBranch("salon-a", "branch-b");
    const qrA = signedBranchQr("salon-a", "branch-a");
    const qrB = signedBranchQr("salon-a", "branch-b");
    await getWebCustomerContext.run(phoneRequest("uid-global", qrA));
    await checkInWebCustomer.run(checkinRequest("uid-global", qrA));

    await expect(checkInWebCustomer.run(checkinRequest("uid-global", qrB))).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("từ chối QR đã xoay và thay phiên active đã hết hạn bằng đúng một phiên mới", async () => {
    await seedSalon("salon-a", "branch-a");
    const oldQr = signedBranchQr("salon-a", "branch-a");
    const context = await getWebCustomerContext.run(phoneRequest("uid-global", oldQr));
    const first = await checkInWebCustomer.run(checkinRequest("uid-global", oldQr));

    await db.collection("branches").doc("branch-a").update({ qrVersion: 2 });
    await expect(
      getWebCustomerContext.run(phoneRequest("uid-global", oldQr)),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });

    const activeSnap = await db
      .collection("active_service_sessions")
      .where("salonId", "==", "salon-a")
      .where("customerId", "==", context.customer.customerId)
      .get();
    const expiredAt = Timestamp.fromMillis(Date.now() - 60_000);
    await Promise.all([
      activeSnap.docs[0].ref.update({ createdAt: expiredAt, expiresAt: expiredAt }),
      db
        .collection("chair_sessions")
        .doc(first.sessionId)
        .update({ createdAt: expiredAt, expiresAt: expiredAt }),
    ]);

    const currentQr = signedBranchQr("salon-a", "branch-a", 2);
    const replacement = await checkInWebCustomer.run(checkinRequest("uid-global", currentQr));
    expect(replacement.sessionId).not.toBe(first.sessionId);
    expect((await db.collection("chair_sessions").doc(first.sessionId).get()).data()?.status).toBe(
      "cancelled",
    );
    expect((await activeSnap.docs[0].ref.get()).data()?.sessionId).toBe(replacement.sessionId);
    const openSessions = await db
      .collection("chair_sessions")
      .where("salonId", "==", "salon-a")
      .where("isOpen", "==", true)
      .get();
    expect(openSessions.docs.map((doc) => doc.id)).toEqual([replacement.sessionId]);
  });

  it("không cho UID khác đọc session, lịch sử hoặc quà", async () => {
    await seedSalon("salon-a", "branch-a");
    const qr = signedBranchQr("salon-a", "branch-a");
    const owner = await getWebCustomerContext.run(phoneRequest("uid-owner", qr));
    const other = await getWebCustomerContext.run(phoneRequest("uid-other", qr, "+84909999999"));
    const checkedIn = await checkInWebCustomer.run(checkinRequest("uid-owner", qr));
    await Promise.all([
      db.collection("haircut_records").add({
        salonId: "salon-a",
        customerId: owner.customer.customerId,
        branchId: "branch-a",
        branchName: "Chi nhánh kiểm thử",
        createdAt: Timestamp.now(),
        pointsAdded: 1,
      }),
      db.collection("haircut_records").add({
        salonId: "salon-a",
        customerId: other.customer.customerId,
        branchId: "branch-a",
        createdAt: Timestamp.now(),
        pointsAdded: 99,
      }),
      db.collection("reward_history").doc("reward-owner").set({
        salonId: "salon-a",
        customerId: owner.customer.customerId,
        rewardName: "Quà owner",
        rewardCode: "HC-OWNER",
        status: "unused",
        createdAt: Timestamp.now(),
      }),
      db.collection("reward_history").doc("reward-other").set({
        salonId: "salon-a",
        customerId: other.customer.customerId,
        rewardName: "Quà khác",
        rewardCode: "HC-OTHER",
        status: "unused",
        createdAt: Timestamp.now(),
      }),
    ]);

    await expect(
      getWebCustomerSession.run(
        phoneRequest("uid-other", { salonId: "salon-a", sessionId: checkedIn.sessionId }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
    const history = await getWebCustomerHistory.run(
      phoneRequest("uid-owner", { salonId: "salon-a", limit: 20 }),
    );
    const rewards = await getWebCustomerRewards.run(
      phoneRequest("uid-owner", { salonId: "salon-a", limit: 20 }),
    );
    expect(history.records).toHaveLength(1);
    expect(history.records[0].pointsAdded).toBe(1);
    expect(rewards.rewards.map((reward: { id: string }) => reward.id)).toEqual(["reward-owner"]);
  });

  it("spin dùng customerId từ auth, trừ điểm đúng một lần và retry idempotent", async () => {
    await seedSalon("salon-a", "branch-a");
    const qr = signedBranchQr("salon-a", "branch-a");
    const context = await getWebCustomerContext.run(phoneRequest("uid-owner", qr));
    await db.collection("customers").doc(context.customer.customerId).update({ points: 10 });
    await db
      .collection("lucky_wheel")
      .doc("salon-a")
      .set({
        configVersion: 1,
        requiredPoints: 5,
        deductPointsAfterSpin: true,
        rewardValidityDays: 30,
        slots: [{ slotId: "slot-a", label: "Quà A", active: true, type: "reward", weight: 1 }],
      });
    const payload = {
      salonId: "salon-a",
      customerId: "customer-forged",
      idempotencyKey: "web-spin-idempotency-123",
      configVersion: 1,
    };

    const first = await spinWebLuckyWheel.run(phoneRequest("uid-owner", payload));
    await db.doc("salons/salon-a").update({ allowWebWheel: false });
    const retry = await spinWebLuckyWheel.run(phoneRequest("uid-owner", payload));
    expect(retry).toEqual(first);
    expect(
      (await db.collection("customers").doc(context.customer.customerId).get()).data()?.points,
    ).toBe(5);
    expect((await db.collection("reward_history").get()).size).toBe(1);
    expect((await db.collection("customers").doc("customer-forged").get()).exists).toBe(false);
  });

  it("spin thiếu điểm ở Salon B không dùng điểm hoặc reward của cùng UID tại Salon A", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedSalon("salon-b", "branch-b");
    const contextA = await getWebCustomerContext.run(
      phoneRequest("uid-global", signedBranchQr("salon-a", "branch-a")),
    );
    const contextB = await getWebCustomerContext.run(
      phoneRequest("uid-global", signedBranchQr("salon-b", "branch-b")),
    );
    await Promise.all([
      db.collection("customers").doc(contextA.customer.customerId).update({ points: 5 }),
      db.collection("customers").doc(contextB.customer.customerId).update({ points: 4 }),
      seedWheel("salon-a"),
      seedWheel("salon-b"),
    ]);

    await expect(
      spinWebLuckyWheel.run(
        phoneRequest("uid-global", {
          salonId: "salon-b",
          idempotencyKey: "web-spin-salon-b-insufficient",
          configVersion: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await spinWebLuckyWheel.run(
      phoneRequest("uid-global", {
        salonId: "salon-a",
        idempotencyKey: "web-spin-salon-a-success",
        configVersion: 1,
      }),
    );
    expect(await contextPoints(contextA.customer.customerId)).toBe(0);
    expect(await contextPoints(contextB.customer.customerId)).toBe(4);
    const rewards = await db.collection("reward_history").get();
    expect(rewards.docs.map((doc) => doc.data().salonId)).toEqual(["salon-a"]);
  });

  it("web customer chỉ nhận reward của mình với đủ trạng thái public", async () => {
    await seedSalon("salon-a", "branch-a");
    await seedSalon("salon-b", "branch-b");
    const contextA = await getWebCustomerContext.run(
      phoneRequest("uid-global", signedBranchQr("salon-a", "branch-a")),
    );
    const contextB = await getWebCustomerContext.run(
      phoneRequest("uid-global", signedBranchQr("salon-b", "branch-b")),
    );
    const now = Date.now();
    await Promise.all([
      seedReward("reward-unused", "salon-a", contextA.customer.customerId, "unused", now + 60_000),
      seedReward("reward-used", "salon-a", contextA.customer.customerId, "used", now - 60_000),
      seedReward("reward-expired", "salon-a", contextA.customer.customerId, "unused", now - 60_000),
      seedReward("reward-revoked", "salon-a", contextA.customer.customerId, "revoked", null),
      seedReward("reward-no-prize", "salon-a", contextA.customer.customerId, "no_prize", null),
      seedReward("reward-salon-b", "salon-b", contextB.customer.customerId, "unused", null),
    ]);

    const result = await getWebCustomerRewards.run(
      phoneRequest("uid-global", { salonId: "salon-a", limit: 20 }),
    );
    expect(
      new Map(
        result.rewards.map((reward: { id: string; status: string }) => [reward.id, reward.status]),
      ),
    ).toEqual(
      new Map([
        ["reward-unused", "unused"],
        ["reward-used", "used"],
        ["reward-expired", "expired"],
        ["reward-revoked", "revoked"],
      ]),
    );
    expect(result.rewards.some((reward: { id: string }) => reward.id === "reward-salon-b")).toBe(
      false,
    );
  });
});

async function seedSalon(salonId: string, branchId: string) {
  await Promise.all([
    db
      .collection("salons")
      .doc(salonId)
      .set({
        name: `Salon ${salonId}`,
        plan: "pro",
        pointPerVisit: 1,
        customerCount: 0,
        isActive: true,
        status: "active",
      }),
    seedBranch(salonId, branchId),
  ]);
}

async function seedBranch(salonId: string, branchId: string, isActive = true) {
  await db.collection("branches").doc(branchId).set({
    salonId,
    name: "Chi nhánh kiểm thử",
    address: "1 Đường A",
    isActive,
    qrVersion: 1,
  });
}

function signedBranchQr(salonId: string, branchId: string, version = 1) {
  return {
    qrType: "branch",
    salonId,
    branchId,
    qrToken: createSignedQrToken(secret, { kind: "branch", salonId, branchId, version }),
  };
}

function signedSalonQr(salonId: string) {
  return {
    qrType: "salon",
    salonId,
    branchId: "",
    qrToken: createSignedQrToken(secret, { kind: "salon", salonId, version: 1 }),
  };
}

function checkinRequest(uid: string, qr: Record<string, unknown>, phone?: string) {
  return phoneRequest(uid, { ...qr, allowPhoto: true }, phone);
}

function phoneRequest(uid: string, data: Record<string, unknown>, phone = "+84901234567") {
  return requestFor(uid, data, {
    phone_number: phone,
    firebase: { sign_in_provider: "phone" },
  });
}

function requestFor(uid: string, data: Record<string, unknown>, token: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}

function unauthenticatedRequest(data: Record<string, unknown>) {
  return { data, rawRequest: { headers: {}, ip: "127.0.0.1" } } as never;
}

async function seedWheel(salonId: string) {
  await db
    .collection("lucky_wheel")
    .doc(salonId)
    .set({
      salonId,
      configVersion: 1,
      requiredPoints: 5,
      deductPointsAfterSpin: true,
      rewardValidityDays: 30,
      slots: [{ slotId: "slot-a", label: "Quà A", active: true, type: "reward", weight: 1 }],
    });
}

async function contextPoints(customerId: string) {
  return Number((await db.collection("customers").doc(customerId).get()).data()?.points ?? 0);
}

async function seedReward(
  rewardId: string,
  salonId: string,
  customerId: string,
  status: string,
  expiresAtMs: number | null,
) {
  await db
    .collection("reward_history")
    .doc(rewardId)
    .set({
      salonId,
      customerId,
      rewardName: `Quà ${rewardId}`,
      rewardCode: `HC-${rewardId.toUpperCase()}`,
      status,
      createdAt: Timestamp.now(),
      ...(expiresAtMs === null ? {} : { expiresAt: Timestamp.fromMillis(expiresAtMs) }),
    });
}
