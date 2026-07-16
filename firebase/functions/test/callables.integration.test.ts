import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  approvePointRequest,
  claimServiceSession,
  createManualCustomer,
  redeemRewardCode,
  restoreRewardCode,
  searchSalonCustomers,
  spinLuckyWheel,
  submitPointRequest,
  updatePendingPointRequestPhotos,
} from "../src/index";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || "demo-haircut";
const db = getFirestore();

describe.skipIf(!emulatorHost)("callable transactions", () => {
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Không xóa được dữ liệu emulator: HTTP ${response.status}`);
    }
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("enforce hạn mức khách trong transaction ở mốc 49/50/51", async () => {
    await seedOwner("owner-quota", "salon-quota", {
      plan: "free",
      freeCustomerLimit: 50,
      customerCount: 49,
    });

    await createManualCustomer.run(
      requestFor("owner-quota", {
        salonId: "salon-quota",
        name: "Khách thứ 50",
        allowPhoto: false,
      }),
    );

    await expect(
      createManualCustomer.run(
        requestFor("owner-quota", {
          salonId: "salon-quota",
          name: "Khách thứ 51",
          allowPhoto: false,
        }),
      ),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    await expect(db.collection("salons").doc("salon-quota").get()).resolves.toMatchObject({
      exists: true,
    });
    expect((await db.collection("salons").doc("salon-quota").get()).data()?.customerCount).toBe(50);
  });

  it("chạy đúng nhận khách, gửi điểm và owner duyệt một lần", async () => {
    const salonId = "salon-flow";
    const branchId = "branch-flow";
    const customerId = "customer-flow";
    const sessionId = "session-flow";
    const now = Timestamp.now();
    await seedOwner("owner-flow", salonId, { pointPerVisit: 1, customerCount: 1 });
    await db
      .collection("users")
      .doc("staff-flow")
      .set({
        salonId,
        role: "staff",
        name: "Nhân viên Nam",
        isActive: true,
        canRedeemRewards: true,
        branchIds: [branchId],
      });
    await db.collection("customers").doc(customerId).set({
      salonId,
      name: "Anh Tân",
      points: 0,
      allowPhoto: false,
    });
    await db
      .collection("chair_sessions")
      .doc(sessionId)
      .set({
        salonId,
        branchId,
        branchName: "Chi nhánh chính",
        customerId,
        customerSummary: { name: "Anh Tân", phoneLast4: "6789", points: 0, allowPhoto: false },
        status: "waiting",
        isOpen: true,
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000),
      });

    await claimServiceSession.run(requestFor("staff-flow", { salonId, sessionId }));
    await submitPointRequest.run(
      requestFor("staff-flow", { salonId, sessionId, note: "Fade thấp", photoUrls: [] }),
    );
    await approvePointRequest.run(requestFor("owner-flow", { salonId, requestId: sessionId }));

    expect((await db.collection("customers").doc(customerId).get()).data()?.points).toBe(1);
    expect((await db.collection("chair_sessions").doc(sessionId).get()).data()?.status).toBe(
      "completed",
    );
    expect((await db.collection("point_requests").doc(sessionId).get()).data()?.status).toBe(
      "approved",
    );
    expect(
      (await db.collection("haircut_records").where("customerId", "==", customerId).get()).size,
    ).toBe(1);
    await expect(
      approvePointRequest.run(requestFor("owner-flow", { salonId, requestId: sessionId })),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("chỉ owner được cập nhật ảnh của yêu cầu đang chờ duyệt", async () => {
    const salonId = "salon-owner-photo";
    const branchId = "branch-owner-photo";
    const customerId = "customer-owner-photo";
    const sessionId = "session-owner-photo";
    await seedOwner("owner-photo", salonId, { customerCount: 1 });
    await db
      .collection("users")
      .doc("staff-photo")
      .set({
        salonId,
        role: "staff",
        name: "Nhân viên ảnh",
        isActive: true,
        branchIds: [branchId],
      });
    await db.collection("customers").doc(customerId).set({
      salonId,
      name: "Khách ảnh",
      points: 0,
      allowPhoto: true,
    });
    await db.collection("chair_sessions").doc(sessionId).set({
      salonId,
      branchId,
      customerId,
      status: "pending_approval",
    });
    await db
      .collection("point_requests")
      .doc(sessionId)
      .set({
        salonId,
        branchId,
        sessionId,
        customerId,
        status: "pending",
        photoUrls: [
          "https://firebasestorage.googleapis.com/v0/b/demo-haircut/o/" +
            encodeURIComponent(
              `salons/${salonId}/customers/${customerId}/haircuts/${sessionId}/photo-existing1234.jpg`,
            ),
        ],
        customerSummary: { name: "Khách ảnh", allowPhoto: true },
      });

    await expect(
      updatePendingPointRequestPhotos.run(
        requestFor("staff-photo", { salonId, requestId: sessionId, photoUrls: [] }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });

    await updatePendingPointRequestPhotos.run(
      requestFor("owner-photo", { salonId, requestId: sessionId, photoUrls: [] }),
    );
    expect((await db.collection("point_requests").doc(sessionId).get()).data()?.photoUrls).toEqual(
      [],
    );
  });

  it("chỉ owner nhận số điện thoại đầy đủ khi tìm khách", async () => {
    const salonId = "salon-customer-phone";
    await seedOwner("owner-customer-phone", salonId, { customerCount: 1 });
    await db.collection("users").doc("staff-customer-phone").set({
      salonId,
      role: "staff",
      name: "Nhân viên",
      isActive: true,
      branchIds: [],
    });
    await db.collection("customers").doc("customer-phone").set({
      salonId,
      name: "Khách có số",
      phone: "84912345678",
      phoneLast4: "5678",
      points: 2,
      allowPhoto: false,
    });

    const ownerResult = await searchSalonCustomers.run(
      requestFor("owner-customer-phone", { salonId, term: "5678" }),
    );
    const staffResult = await searchSalonCustomers.run(
      requestFor("staff-customer-phone", { salonId, term: "5678" }),
    );

    expect(ownerResult.customers[0]).toMatchObject({
      phone: "84912345678",
      phoneLast4: "5678",
    });
    expect(staffResult.customers[0]).toMatchObject({ phoneLast4: "5678" });
    expect(staffResult.customers[0]).not.toHaveProperty("phone");
  });

  it("quay, đổi và hoàn tác quà giữ đúng điểm và trạng thái", async () => {
    const salonId = "salon-reward";
    const customerId = "customer-reward";
    await seedOwner("owner-reward", salonId, { customerCount: 1 });
    await db
      .collection("users")
      .doc("staff-reward")
      .set({
        salonId,
        role: "staff",
        name: "Nhân viên Quà",
        isActive: true,
        canRedeemRewards: true,
        branchIds: ["branch-reward"],
      });
    await db.collection("customers").doc(customerId).set({
      salonId,
      name: "Khách nhận quà",
      points: 5,
      allowPhoto: false,
      lastBranchId: "branch-reward",
      lastBranchName: "Chi nhánh chính",
    });
    await db
      .collection("lucky_wheel")
      .doc(salonId)
      .set({
        salonId,
        requiredPoints: 5,
        rewardValidityDays: 30,
        deductPointsAfterSpin: true,
        slots: [{ label: "Gội đầu miễn phí", active: true, type: "reward" }],
      });

    const spin = await spinLuckyWheel.run(requestFor("owner-reward", { salonId, customerId }));
    expect(spin.isWinning).toBe(true);
    expect((await db.collection("customers").doc(customerId).get()).data()?.points).toBe(0);

    await redeemRewardCode.run(
      requestFor("staff-reward", { salonId, rewardCode: spin.rewardCode }),
    );
    expect((await db.collection("reward_history").doc(spin.rewardId).get()).data()?.status).toBe(
      "used",
    );

    await restoreRewardCode.run(
      requestFor("owner-reward", {
        salonId,
        rewardCode: spin.rewardCode,
        reason: "Kiểm thử hoàn tác",
      }),
    );
    expect((await db.collection("reward_history").doc(spin.rewardId).get()).data()?.status).toBe(
      "unused",
    );
    expect(
      (await db.collection("audit_events").where("salonId", "==", salonId).get()).size,
    ).toBeGreaterThanOrEqual(2);
  });
});

async function seedOwner(uid: string, salonId: string, salonPatch: Record<string, unknown> = {}) {
  await Promise.all([
    db.collection("users").doc(uid).set({
      salonId,
      role: "owner",
      name: "Chủ salon",
      isActive: true,
      branchIds: [],
    }),
    db
      .collection("salons")
      .doc(salonId)
      .set({
        name: "HAIRCUT Test",
        ownerId: uid,
        plan: "free",
        freeCustomerLimit: 50,
        pointPerVisit: 1,
        customerCount: 0,
        ...salonPatch,
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
