import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  approvePointRequest,
  cancelSessionAsSystemAdmin,
  cancelSalonDeletion,
  claimServiceSession,
  createManualCustomer,
  getSystemAdminOverview,
  getSalonDeletionStatus,
  getManagerPointRequestHistory,
  getManagerRewardHistory,
  getManagerSessionHistory,
  redeemRewardCode,
  rejectPointRequest,
  requestSalonDeletion,
  restoreRewardCode,
  searchSalonCustomers,
  spinLuckyWheel,
  submitPointRequest,
  updatePendingPointRequestPhotos,
  updateSystemAdminUserStatus,
  updateSystemAdminSalonStatus,
  updateSystemFeatureFlags,
} from "../src/index";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || "demo-haircut";
const db = getFirestore();
const originalAdminWriteFlag = process.env.ADMIN_WRITE_OPERATIONS_ENABLED;

describe.skipIf(!emulatorHost)("callable transactions", () => {
  beforeEach(async () => {
    delete process.env.ADMIN_WRITE_OPERATIONS_ENABLED;
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Không xóa được dữ liệu emulator: HTTP ${response.status}`);
    }
  });

  afterAll(async () => {
    if (originalAdminWriteFlag === undefined) delete process.env.ADMIN_WRITE_OPERATIONS_ENABLED;
    else process.env.ADMIN_WRITE_OPERATIONS_ENABLED = originalAdminWriteFlag;
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

  it("bắt buộc lý do hợp lệ khi owner từ chối yêu cầu điểm", async () => {
    const salonId = "salon-reject-reason";
    const branchId = "branch-reject-reason";
    const customerId = "customer-reject-reason";
    const requestId = "request-reject-reason";
    await seedOwner("owner-reject-reason", salonId);
    await seedBranch(salonId, branchId);
    await db.collection("customers").doc(customerId).set({
      salonId,
      name: "Khách từ chối",
      points: 2,
    });
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
      status: "pending",
      pointsRequested: 1,
      photoUrls: [],
    });

    for (const reason of ["", "Sai"]) {
      await expect(
        rejectPointRequest.run(requestFor("owner-reject-reason", { salonId, requestId, reason })),
      ).rejects.toMatchObject({
        code: "invalid-argument",
        details: { errorCode: "INVALID_REQUEST" },
      });
    }

    await rejectPointRequest.run(
      requestFor("owner-reject-reason", {
        salonId,
        requestId,
        reason: "  Thiếu   thông tin lượt cắt  ",
      }),
    );
    expect((await db.collection("point_requests").doc(requestId).get()).data()).toMatchObject({
      status: "rejected",
      rejectionReason: "Thiếu thông tin lượt cắt",
      processedBy: "owner-reject-reason",
    });
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
    const branchId = "branch-customer-phone";
    await seedOwner("owner-customer-phone", salonId, { customerCount: 1 });
    await seedBranch(salonId, branchId);
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
      allowPhoto: true,
    });
    await db
      .collection("haircut_records")
      .doc("record-customer-phone")
      .set({
        salonId,
        branchId,
        branchName: "Chi nhánh kiểm thử",
        customerId: "customer-phone",
        staffName: "Nhân viên",
        pointRequestId: "session-customer-phone",
        photoUrls: [
          "https://firebasestorage.googleapis.com/v0/b/demo-haircut.appspot.com/o/" +
            encodeURIComponent(
              `salons/${salonId}/customers/customer-phone/haircuts/session-customer-phone/photo-history12345.jpg`,
            ),
        ],
        pointsAdded: 1,
        createdAt: Timestamp.now(),
      });
    await db.collection("reward_history").doc("reward-customer-phone").set({
      salonId,
      branchId,
      customerId: "customer-phone",
      rewardName: "Gội đầu",
      rewardCode: "PHONE-REWARD-1234",
      status: "used",
      createdAt: Timestamp.now(),
      usedAt: Timestamp.now(),
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
    expect(ownerResult.customers[0].branchVisits).toEqual([
      expect.objectContaining({ branchId, branchName: "Chi nhánh kiểm thử" }),
    ]);
    expect(ownerResult.customers[0].recentRecords[0].photoUrls).toHaveLength(1);
    expect(ownerResult.customers[0].rewardHistory).toEqual([
      expect.objectContaining({ rewardCode: "PHONE-REWARD-1234", status: "used" }),
    ]);
    expect(staffResult.customers[0]).toMatchObject({ phoneLast4: "5678" });
    expect(staffResult.customers[0]).not.toHaveProperty("phone");
    expect(staffResult.customers[0].recentRecords[0].photoUrls).toEqual([]);
    expect(staffResult.customers[0].rewardHistory).toEqual([]);
  });

  it("cô lập lịch sử Manager theo salon, chi nhánh và nhân viên", async () => {
    const salonId = "salon-manager-history";
    const branchA = "branch-manager-a";
    const branchB = "branch-manager-b";
    const now = Timestamp.now();
    await seedOwner("owner-manager-history", salonId, { customerCount: 1 });
    await Promise.all([seedBranch(salonId, branchA), seedBranch(salonId, branchB)]);
    await Promise.all([
      db
        .collection("users")
        .doc("staff-manager-a")
        .set({
          salonId,
          role: "staff",
          name: "Nhân viên A",
          isActive: true,
          canRedeemRewards: true,
          branchIds: [branchA],
        }),
      db
        .collection("users")
        .doc("staff-manager-b")
        .set({
          salonId,
          role: "staff",
          name: "Nhân viên B",
          isActive: true,
          canRedeemRewards: true,
          branchIds: [branchB],
        }),
      db
        .collection("customers")
        .doc("customer-manager-history")
        .set({
          salonId,
          name: "Khách lịch sử",
          phone: "84912345678",
          phoneLast4: "5678",
          points: 4,
          allowPhoto: true,
          namePrefixes: ["kh", "khá", "khách"],
        }),
    ]);

    await Promise.all([
      db
        .collection("chair_sessions")
        .doc("session-manager-completed")
        .set({
          salonId,
          branchId: branchA,
          branchName: "Chi nhánh A",
          customerId: "customer-manager-history",
          customerSummary: { name: "Khách lịch sử", phoneLast4: "5678" },
          assignedStaffId: "staff-manager-a",
          assignedStaffName: "Nhân viên A",
          status: "completed",
          createdAt: now,
          completedAt: now,
        }),
      db
        .collection("chair_sessions")
        .doc("session-manager-no-show")
        .set({
          salonId,
          branchId: branchA,
          branchName: "Chi nhánh A",
          customerId: "customer-manager-history",
          customerSummary: { name: "Khách lịch sử", phoneLast4: "5678" },
          cancelledBy: "staff-manager-a",
          status: "cancelled",
          cancellationReason: "no_show",
          createdAt: now,
          cancelledAt: now,
        }),
      db.collection("chair_sessions").doc("session-manager-other-branch").set({
        salonId,
        branchId: branchB,
        branchName: "Chi nhánh B",
        customerId: "customer-manager-history",
        assignedStaffId: "staff-manager-b",
        status: "completed",
        createdAt: now,
        completedAt: now,
      }),
      db
        .collection("point_requests")
        .doc("request-manager-approved")
        .set({
          salonId,
          branchId: branchA,
          branchName: "Chi nhánh A",
          sessionId: "session-manager-completed",
          customerId: "customer-manager-history",
          customerSummary: { name: "Khách lịch sử", phoneLast4: "5678" },
          staffName: "Nhân viên A",
          status: "approved",
          pointsAdded: 1,
          createdAt: now,
          processedAt: now,
        }),
      db.collection("reward_history").doc("reward-manager-a").set({
        salonId,
        branchId: branchA,
        usedBranchId: branchA,
        customerId: "customer-manager-history",
        rewardName: "Gội đầu",
        rewardCode: "REWARD-A-1234",
        status: "used",
        usedBy: "staff-manager-a",
        createdAt: now,
        usedAt: now,
      }),
      db.collection("reward_history").doc("reward-manager-b").set({
        salonId,
        branchId: branchB,
        usedBranchId: branchB,
        customerId: "customer-manager-history",
        rewardName: "Sáp tóc",
        rewardCode: "REWARD-B-5678",
        status: "used",
        usedBy: "staff-manager-b",
        createdAt: now,
        usedAt: now,
      }),
    ]);

    const staffSessions = await getManagerSessionHistory.run(
      requestFor("staff-manager-a", { salonId, limit: 30 }),
    );
    expect(staffSessions.sessions.map((session) => session.id).sort()).toEqual([
      "session-manager-completed",
      "session-manager-no-show",
    ]);
    expect(staffSessions.sessions[0]?.customer).not.toHaveProperty("phone");
    await expect(
      getManagerSessionHistory.run(requestFor("staff-manager-a", { salonId, branchId: branchB })),
    ).rejects.toMatchObject({ details: { errorCode: "BRANCH_ACCESS_DENIED" } });

    const ownerSessions = await getManagerSessionHistory.run(
      requestFor("owner-manager-history", { salonId, limit: 30 }),
    );
    expect(ownerSessions.sessions).toHaveLength(3);
    expect(ownerSessions.sessions[0]?.customer).toHaveProperty("phone", "84912345678");

    const approvalHistory = await getManagerPointRequestHistory.run(
      requestFor("owner-manager-history", { salonId, branchId: branchA }),
    );
    expect(approvalHistory.requests).toHaveLength(1);
    expect(approvalHistory.requests[0]).toMatchObject({ status: "approved", pointsAdded: 1 });

    const staffRewards = await getManagerRewardHistory.run(
      requestFor("staff-manager-a", { salonId, limit: 30 }),
    );
    expect(staffRewards.rewards).toHaveLength(1);
    expect(staffRewards.rewards[0]).toMatchObject({ rewardCodeLast4: "1234" });
    expect(staffRewards.rewards[0]).not.toHaveProperty("rewardCode");

    const ownerRewards = await getManagerRewardHistory.run(
      requestFor("owner-manager-history", { salonId, limit: 30 }),
    );
    expect(ownerRewards.rewards).toHaveLength(2);
    expect(ownerRewards.rewards[0]).toHaveProperty("rewardCode");
  });

  it("lọc lịch sử quà theo chi nhánh trước limit và giữ tương thích dữ liệu cũ", async () => {
    const salonId = "salon-reward-branch-filter";
    const otherSalonId = "salon-reward-other";
    const branchA = "branch-reward-filter-a";
    const branchB = "branch-reward-filter-b";
    const limit = 5;
    const baseMs = Date.now();
    await Promise.all([
      seedOwner("owner-reward-filter", salonId, { customerCount: 1 }),
      seedOwner("owner-reward-other", otherSalonId, { customerCount: 1 }),
      seedBranch(salonId, branchA),
      seedBranch(salonId, branchB),
    ]);
    await Promise.all([
      db
        .collection("users")
        .doc("staff-reward-filter")
        .set({
          salonId,
          role: "staff",
          name: "Nhân viên A",
          isActive: true,
          canRedeemRewards: true,
          branchIds: [branchA],
        }),
      db
        .collection("users")
        .doc("staff-reward-filter-other")
        .set({
          salonId,
          role: "staff",
          name: "Nhân viên khác",
          isActive: true,
          canRedeemRewards: true,
          branchIds: [branchA],
        }),
      db.collection("customers").doc("customer-reward-filter").set({
        salonId,
        name: "Khách chi nhánh A",
        points: 0,
      }),
    ]);

    const newerBranchBWrites = Array.from({ length: limit + 3 }, (_, index) =>
      db
        .collection("reward_history")
        .doc(`reward-filter-b-${index}`)
        .set({
          salonId,
          branchId: branchB,
          usedBranchId: branchB,
          customerId: "customer-reward-filter",
          rewardName: `Quà B ${index}`,
          rewardCode: `BRANCH-B-${index}`,
          status: "used",
          usedBy: "staff-reward-filter-other",
          createdAt: Timestamp.fromMillis(baseMs + index + 1_000),
          usedAt: Timestamp.fromMillis(baseMs + index + 1_000),
        }),
    );
    await Promise.all([
      ...newerBranchBWrites,
      db
        .collection("reward_history")
        .doc("reward-filter-a-current")
        .set({
          salonId,
          branchId: branchA,
          usedBranchId: branchA,
          customerId: "customer-reward-filter",
          rewardName: "Quà A mới",
          rewardCode: "BRANCH-A-CURRENT",
          status: "used",
          usedBy: "staff-reward-filter",
          createdAt: Timestamp.fromMillis(baseMs - 1_000),
          usedAt: Timestamp.fromMillis(baseMs - 1_000),
        }),
      db
        .collection("reward_history")
        .doc("reward-filter-a-legacy")
        .set({
          salonId,
          branchId: branchA,
          customerId: "customer-reward-filter",
          rewardName: "Quà A cũ",
          rewardCode: "BRANCH-A-LEGACY",
          status: "used",
          usedBy: "staff-reward-filter",
          createdAt: Timestamp.fromMillis(baseMs - 2_000),
          usedAt: Timestamp.fromMillis(baseMs - 2_000),
        }),
      ...Array.from({ length: limit }, (_, index) =>
        db
          .collection("reward_history")
          .doc(`reward-filter-a-current-older-${index}`)
          .set({
            salonId,
            branchId: branchA,
            usedBranchId: branchA,
            customerId: "customer-reward-filter",
            rewardName: `Quà A schema mới cũ hơn ${index}`,
            rewardCode: `BRANCH-A-CURRENT-OLDER-${index}`,
            status: "used",
            usedBy: "staff-reward-filter-other",
            createdAt: Timestamp.fromMillis(baseMs - 10_000 - index),
            usedAt: Timestamp.fromMillis(baseMs - 10_000 - index),
          }),
      ),
      db
        .collection("reward_history")
        .doc("reward-filter-a-other-staff")
        .set({
          salonId,
          branchId: branchA,
          usedBranchId: branchA,
          customerId: "customer-reward-filter",
          rewardName: "Quà A nhân viên khác",
          rewardCode: "BRANCH-A-OTHER",
          status: "used",
          usedBy: "staff-reward-filter-other",
          createdAt: Timestamp.fromMillis(baseMs - 3_000),
          usedAt: Timestamp.fromMillis(baseMs - 3_000),
        }),
      db
        .collection("reward_history")
        .doc("reward-filter-other-salon")
        .set({
          salonId: otherSalonId,
          branchId: branchA,
          usedBranchId: branchA,
          customerId: "customer-other-salon",
          rewardName: "Quà salon khác",
          rewardCode: "OTHER-SALON",
          status: "used",
          usedBy: "owner-reward-other",
          createdAt: Timestamp.fromMillis(baseMs + 10_000),
          usedAt: Timestamp.fromMillis(baseMs + 10_000),
        }),
    ]);

    const ownerResult = await getManagerRewardHistory.run(
      requestFor("owner-reward-filter", { salonId, branchId: branchA, limit }),
    );
    expect(ownerResult.rewards.map((reward) => reward.id)).toEqual([
      "reward-filter-a-current",
      "reward-filter-a-legacy",
      "reward-filter-a-other-staff",
      "reward-filter-a-current-older-0",
      "reward-filter-a-current-older-1",
    ]);
    expect(ownerResult.rewards.every((reward) => reward.branchId === branchA)).toBe(true);
    expect(ownerResult.rewards.some((reward) => reward.id.startsWith("reward-filter-b-"))).toBe(
      false,
    );
    expect(ownerResult.rewards).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "reward-filter-other-salon" })]),
    );

    const staffResult = await getManagerRewardHistory.run(
      requestFor("staff-reward-filter", { salonId, branchId: branchA, limit }),
    );
    expect(staffResult.rewards.map((reward) => reward.id)).toEqual([
      "reward-filter-a-current",
      "reward-filter-a-legacy",
    ]);
    expect(staffResult.rewards.every((reward) => !Object.hasOwn(reward, "rewardCode"))).toBe(true);
    await expect(
      getManagerRewardHistory.run(
        requestFor("owner-reward-filter", {
          salonId: otherSalonId,
          branchId: branchA,
          limit,
        }),
      ),
    ).rejects.toMatchObject({ details: { errorCode: "FORBIDDEN" } });
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

  it("chỉ system admin đọc được tổng quan hệ thống", async () => {
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
    await expect(getSystemAdminOverview.run(requestFor("", {}))).rejects.toMatchObject({
      details: { errorCode: "UNAUTHENTICATED" },
    });

    const overview = await getSystemAdminOverview.run(requestFor("system-admin", {}));
    expect(overview.salons.total).toBe(1);
  });

  it("khóa toàn bộ callable ghi Admin khi flag server mặc định tắt", async () => {
    const salonId = "salon-admin-read-only";
    const adminId = "system-admin-read-only";
    await seedOwner("owner-admin-read-only", salonId);
    await db.collection("users").doc(adminId).set({
      role: "system_admin",
      name: "Quản trị hệ thống",
      isActive: true,
    });

    const writeAttempts = await Promise.allSettled([
      updateSystemAdminSalonStatus.run(
        requestFor(adminId, { salonId, status: "suspended", reason: "test" }),
      ),
      updateSystemFeatureFlags.run(requestFor(adminId, { features: { maintenanceMode: true } })),
      updateSystemAdminUserStatus.run(
        requestFor(adminId, { uid: "owner-admin-read-only", isActive: false, reason: "test" }),
      ),
      cancelSessionAsSystemAdmin.run(
        requestFor(adminId, { sessionId: "session-not-used", reason: "test" }),
      ),
    ]);

    for (const attempt of writeAttempts) {
      expect(attempt).toMatchObject({
        status: "rejected",
        reason: { details: { errorCode: "ADMIN_WRITE_DISABLED" } },
      });
    }
    expect((await db.collection("salons").doc(salonId).get()).data()).toMatchObject({
      name: "HAIRCUT Test",
    });
    expect((await db.collection("salons").doc(salonId).get()).data()).not.toHaveProperty("status");
    expect((await db.collection("users").doc("owner-admin-read-only").get()).data()?.isActive).toBe(
      true,
    );
  });

  it("chỉ cho phép callable ghi khi flag server được bật rõ ràng", async () => {
    const salonId = "salon-admin-write-flag";
    const adminId = "system-admin-write-flag";
    await seedOwner("owner-admin-write-flag", salonId);
    await db.collection("users").doc(adminId).set({
      role: "system_admin",
      name: "Quản trị hệ thống",
      isActive: true,
    });
    process.env.ADMIN_WRITE_OPERATIONS_ENABLED = "true";

    try {
      await updateSystemAdminSalonStatus.run(
        requestFor(adminId, {
          salonId,
          status: "suspended",
          reason: "Kiểm thử flag",
        }),
      );
    } finally {
      delete process.env.ADMIN_WRITE_OPERATIONS_ENABLED;
    }

    expect((await db.collection("salons").doc(salonId).get()).data()?.status).toBe("suspended");
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
