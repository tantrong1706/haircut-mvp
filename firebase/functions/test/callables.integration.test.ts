import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  approvePointRequest,
  cancelSalonDeletion,
  claimServiceSession,
  createManualCustomer,
  getSystemAdminOverview,
  getSalonDeletionStatus,
  redeemRewardCode,
  requestSalonDeletion,
  restoreRewardCode,
  searchSalonCustomers,
  spinLuckyWheel,
  submitPointRequest,
  updatePendingPointRequestPhotos,
  updateSystemAdminSalonStatus,
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
    await seedBranch(salonId, branchId);
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
    const firstSubmit = await submitPointRequest.run(
      requestFor("staff-flow", { salonId, sessionId, note: "Fade thấp", photoUrls: [] }),
    );
    const repeatedSubmit = await submitPointRequest.run(
      requestFor("staff-flow", { salonId, sessionId, note: "Fade thấp", photoUrls: [] }),
    );
    expect(firstSubmit).toMatchObject({ requestId: sessionId, alreadySubmitted: false });
    expect(repeatedSubmit).toMatchObject({ requestId: sessionId, alreadySubmitted: true });

    const firstApproval = await approvePointRequest.run(
      requestFor("owner-flow", { salonId, requestId: sessionId }),
    );
    const repeatedApproval = await approvePointRequest.run(
      requestFor("owner-flow", { salonId, requestId: sessionId }),
    );
    expect(firstApproval).toMatchObject({ ok: true, alreadyProcessed: false });
    expect(repeatedApproval).toMatchObject({ ok: true, alreadyProcessed: true });

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
    expect((await db.collection("customers").doc(customerId).get()).data()?.points).toBe(1);
  });

  it("chỉ owner được cập nhật ảnh của yêu cầu đang chờ duyệt", async () => {
    const salonId = "salon-owner-photo";
    const branchId = "branch-owner-photo";
    const customerId = "customer-owner-photo";
    const sessionId = "session-owner-photo";
    await seedOwner("owner-photo", salonId, { customerCount: 1 });
    await seedBranch(salonId, branchId);
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
    await seedBranch(salonId, "branch-reward");
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

    const spin = await spinLuckyWheel.run(
      requestFor("owner-reward", {
        salonId,
        customerId,
        idempotencyKey: "spin-reward-test-0001",
      }),
    );
    const repeatedSpin = await spinLuckyWheel.run(
      requestFor("owner-reward", {
        salonId,
        customerId,
        idempotencyKey: "spin-reward-test-0001",
      }),
    );
    expect(spin.isWinning).toBe(true);
    expect(repeatedSpin).toEqual(spin);
    expect((await db.collection("customers").doc(customerId).get()).data()?.points).toBe(0);
    expect((await db.collection("reward_history").where("salonId", "==", salonId).get()).size).toBe(
      1,
    );

    const firstRedemption = await redeemRewardCode.run(
      requestFor("staff-reward", {
        salonId,
        rewardCode: spin.rewardCode,
        idempotencyKey: "redeem-reward-test-0001",
      }),
    );
    const repeatedRedemption = await redeemRewardCode.run(
      requestFor("staff-reward", {
        salonId,
        rewardCode: spin.rewardCode,
        idempotencyKey: "redeem-reward-test-0001",
      }),
    );
    expect(firstRedemption.alreadyRedeemed).toBe(false);
    expect(repeatedRedemption.alreadyRedeemed).toBe(true);
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

  it("chặn tenant giả, document thiếu salonId, tài khoản và salon bị khóa", async () => {
    await Promise.all([
      seedOwner("owner-tenant-a", "salon-tenant-a"),
      seedOwner("owner-tenant-b", "salon-tenant-b"),
      seedBranch("salon-tenant-a", "branch-tenant-a"),
      seedBranch("salon-tenant-b", "branch-tenant-b"),
    ]);
    await db
      .collection("users")
      .doc("staff-tenant-a")
      .set({
        salonId: "salon-tenant-a",
        role: "staff",
        name: "Nhân viên A",
        isActive: true,
        branchIds: ["branch-tenant-a"],
      });
    await db
      .collection("users")
      .doc("staff-inactive")
      .set({
        salonId: "salon-tenant-a",
        role: "staff",
        name: "Nhân viên khóa",
        isActive: false,
        branchIds: ["branch-tenant-a"],
      });
    const now = Timestamp.now();
    await db
      .collection("chair_sessions")
      .doc("session-tenant-b")
      .set({
        salonId: "salon-tenant-b",
        branchId: "branch-tenant-b",
        customerId: "customer-tenant-b",
        status: "waiting",
        isOpen: true,
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60_000),
      });
    await db
      .collection("chair_sessions")
      .doc("session-missing-tenant")
      .set({
        branchId: "branch-tenant-a",
        customerId: "customer-missing-tenant",
        status: "waiting",
        isOpen: true,
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60_000),
      });

    await expect(
      claimServiceSession.run(
        requestFor("staff-tenant-a", {
          salonId: "salon-tenant-b",
          sessionId: "session-tenant-b",
        }),
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
      details: { errorCode: "FORBIDDEN" },
    });
    expect(
      (
        await db
          .collection("audit_events")
          .where("salonId", "==", "salon-tenant-a")
          .where("action", "==", "salon.cross_tenant_access_blocked")
          .get()
      ).size,
    ).toBe(1);

    await expect(
      claimServiceSession.run(
        requestFor("staff-tenant-a", {
          salonId: "salon-tenant-a",
          sessionId: "session-tenant-b",
        }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "INVALID_REQUEST" } });
    await expect(
      claimServiceSession.run(
        requestFor("staff-tenant-a", {
          salonId: "salon-tenant-a",
          sessionId: "session-missing-tenant",
        }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "INVALID_REQUEST" } });
    await expect(
      claimServiceSession.run(
        requestFor("staff-inactive", {
          salonId: "salon-tenant-a",
          sessionId: "session-missing-tenant",
        }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "USER_INACTIVE" } });

    await db
      .collection("salons")
      .doc("salon-tenant-a")
      .set({ status: "suspended" }, { merge: true });
    await expect(
      claimServiceSession.run(
        requestFor("staff-tenant-a", {
          salonId: "salon-tenant-a",
          sessionId: "session-missing-tenant",
        }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "SALON_SUSPENDED" } });
  });

  it("chặn staff sai chi nhánh và chỉ một staff nhận được khách", async () => {
    const salonId = "salon-concurrent-claim";
    const branchId = "branch-concurrent-claim";
    const otherBranchId = "branch-not-assigned";
    await seedOwner("owner-concurrent-claim", salonId);
    await Promise.all([seedBranch(salonId, branchId), seedBranch(salonId, otherBranchId)]);
    for (const uid of ["staff-claim-a", "staff-claim-b"]) {
      await db
        .collection("users")
        .doc(uid)
        .set({
          salonId,
          role: "staff",
          name: uid,
          isActive: true,
          branchIds: [branchId],
        });
    }
    const now = Timestamp.now();
    await db
      .collection("chair_sessions")
      .doc("session-wrong-branch")
      .set({
        salonId,
        branchId: otherBranchId,
        customerId: "customer-wrong-branch",
        status: "waiting",
        isOpen: true,
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60_000),
      });
    await expect(
      claimServiceSession.run(
        requestFor("staff-claim-a", { salonId, sessionId: "session-wrong-branch" }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "BRANCH_ACCESS_DENIED" } });
    expect(
      (
        await db
          .collection("audit_events")
          .where("action", "==", "staff.branch_access_denied")
          .get()
      ).size,
    ).toBe(1);

    await db
      .collection("chair_sessions")
      .doc("session-concurrent-claim")
      .set({
        salonId,
        branchId,
        customerId: "customer-concurrent-claim",
        status: "waiting",
        isOpen: true,
        createdAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 60_000),
      });
    const attempts = await Promise.allSettled([
      claimServiceSession.run(
        requestFor("staff-claim-a", { salonId, sessionId: "session-concurrent-claim" }),
      ),
      claimServiceSession.run(
        requestFor("staff-claim-b", { salonId, sessionId: "session-concurrent-claim" }),
      ),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejection = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejection).toMatchObject({
      status: "rejected",
      reason: { details: { errorCode: "SESSION_ALREADY_CLAIMED" } },
    });
    const session = (
      await db.collection("chair_sessions").doc("session-concurrent-claim").get()
    ).data();
    expect(["staff-claim-a", "staff-claim-b"]).toContain(session?.assignedStaffId);
    expect(session?.status).toBe("serving");
    expect(
      (
        await db
          .collection("audit_events")
          .where("action", "==", "session.claimed")
          .where("targetId", "==", "session-concurrent-claim")
          .get()
      ).size,
    ).toBe(1);
  });

  it("duyệt đồng thời chỉ cộng điểm và tạo lịch sử một lần", async () => {
    const salonId = "salon-concurrent-approval";
    const branchId = "branch-concurrent-approval";
    const customerId = "customer-concurrent-approval";
    const requestId = "request-concurrent-approval";
    await seedOwner("owner-concurrent-approval", salonId);
    await seedBranch(salonId, branchId);
    await db.collection("customers").doc(customerId).set({ salonId, name: "Khách", points: 2 });
    await db.collection("chair_sessions").doc(requestId).set({
      salonId,
      branchId,
      customerId,
      status: "pending_approval",
      isOpen: true,
    });
    await db.collection("point_requests").doc(requestId).set({
      salonId,
      branchId,
      sessionId: requestId,
      customerId,
      staffId: "staff-old",
      status: "pending",
      pointsRequested: 1,
      photoUrls: [],
    });

    const results = await Promise.all([
      approvePointRequest.run(requestFor("owner-concurrent-approval", { salonId, requestId })),
      approvePointRequest.run(requestFor("owner-concurrent-approval", { salonId, requestId })),
    ]);
    expect(results.some((result) => result.alreadyProcessed === false)).toBe(true);
    expect((await db.collection("customers").doc(customerId).get()).data()?.points).toBe(3);
    expect(
      (await db.collection("haircut_records").where("pointRequestId", "==", requestId).get()).size,
    ).toBe(1);
    const processed = (await db.collection("point_requests").doc(requestId).get()).data();
    expect(processed).toMatchObject({
      pointsBefore: 2,
      pointsAfter: 3,
      processedBy: "owner-concurrent-approval",
    });
  });

  it("hai request đổi cùng mã quà chỉ một request thành công", async () => {
    const salonId = "salon-concurrent-reward";
    const branchId = "branch-concurrent-reward";
    const customerId = "customer-concurrent-reward";
    await seedOwner("owner-concurrent-reward", salonId);
    await seedBranch(salonId, branchId);
    await db
      .collection("users")
      .doc("staff-concurrent-reward")
      .set({
        salonId,
        role: "staff",
        name: "Nhân viên",
        isActive: true,
        canRedeemRewards: true,
        branchIds: [branchId],
      });
    await db.collection("customers").doc(customerId).set({ salonId, name: "Khách", points: 0 });
    await db
      .collection("reward_history")
      .doc("reward-concurrent")
      .set({
        salonId,
        branchId,
        customerId,
        rewardCode: "HC-CONCURRENT-1234",
        rewardName: "Gội đầu",
        status: "unused",
        expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
      });

    const attempts = await Promise.allSettled([
      redeemRewardCode.run(
        requestFor("staff-concurrent-reward", {
          salonId,
          branchId,
          rewardCode: "HC-CONCURRENT-1234",
          idempotencyKey: "redeem-concurrent-key-0001",
        }),
      ),
      redeemRewardCode.run(
        requestFor("staff-concurrent-reward", {
          salonId,
          branchId,
          rewardCode: "HC-CONCURRENT-1234",
          idempotencyKey: "redeem-concurrent-key-0002",
        }),
      ),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.find((attempt) => attempt.status === "rejected")).toMatchObject({
      reason: { details: { errorCode: "REWARD_ALREADY_REDEEMED" } },
    });
    expect(
      (await db.collection("reward_history").doc("reward-concurrent").get()).data(),
    ).toMatchObject({
      status: "used",
      usedBranchId: branchId,
    });
  });

  it("chỉ system admin được khóa salon và thao tác luôn có audit", async () => {
    const salonId = "salon-system-admin";
    await seedOwner("owner-system-admin-target", salonId);
    await db.collection("users").doc("system-admin").set({
      role: "system_admin",
      name: "Quản trị hệ thống",
      isActive: true,
    });

    await expect(
      getSystemAdminOverview.run(requestFor("owner-system-admin-target", {})),
    ).rejects.toMatchObject({ details: { errorCode: "FORBIDDEN" } });

    const overview = await getSystemAdminOverview.run(requestFor("system-admin", {}));
    expect(overview.salons.total).toBe(1);
    await updateSystemAdminSalonStatus.run(
      requestFor("system-admin", {
        salonId,
        status: "suspended",
        reason: "Kiểm thử vận hành",
      }),
    );
    expect((await db.collection("salons").doc(salonId).get()).data()?.status).toBe("suspended");
    expect(
      (
        await db
          .collection("audit_events")
          .where("action", "==", "admin.salon_suspended")
          .where("targetId", "==", salonId)
          .get()
      ).size,
    ).toBe(1);
  });

  it("yêu cầu xóa salon idempotent và có thể hủy trong thời gian chờ", async () => {
    const salonId = "salon-deletion-flow";
    const ownerId = "owner-deletion-flow";
    await seedOwner(ownerId, salonId);

    const first = await requestSalonDeletion.run(
      recentRequestFor(ownerId, { salonId, salonName: "HAIRCUT Test" }),
    );
    const repeated = await requestSalonDeletion.run(
      recentRequestFor(ownerId, { salonId, salonName: "HAIRCUT Test" }),
    );
    expect(first).toMatchObject({ status: "requested", alreadyRequested: false });
    expect(repeated).toMatchObject({
      status: "requested",
      alreadyRequested: true,
      executeAfterMs: first.executeAfterMs,
    });
    expect((await db.collection("salons").doc(salonId).get()).data()?.status).toBe(
      "pending_deletion",
    );
    expect(await getSalonDeletionStatus.run(recentRequestFor(ownerId, { salonId }))).toMatchObject({
      status: "requested",
      executeAfterMs: first.executeAfterMs,
    });

    await cancelSalonDeletion.run(recentRequestFor(ownerId, { salonId }));
    expect((await db.collection("salons").doc(salonId).get()).data()).toMatchObject({
      status: "active",
      isActive: true,
    });
    expect((await db.collection("salon_deletion_jobs").doc(salonId).get()).data()?.status).toBe(
      "cancelled",
    );
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

async function seedBranch(salonId: string, branchId: string, isActive = true) {
  await db.collection("branches").doc(branchId).set({
    salonId,
    name: "Chi nhánh kiểm thử",
    isActive,
  });
}

function requestFor(uid: string, data: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token: {} },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}

function recentRequestFor(uid: string, data: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
