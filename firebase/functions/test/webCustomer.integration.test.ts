import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approvePointRequest,
  checkInWebCustomer,
  getWebCustomerContext,
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSession,
  listBranches,
  spinWebLuckyWheel,
} from "../src/index";
import { createSignedQrToken } from "../src/security";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const secret = "fixture-qr-signing-key-only-32-characters";

describe("authenticated web customer platform", () => {
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
      checkInWebCustomer.run(phoneRequest("uid-global", qr)),
      checkInWebCustomer.run(phoneRequest("uid-global", qr)),
    ]);
    const retry = await checkInWebCustomer.run(phoneRequest("uid-global", qr));

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
    const checkedIn = await checkInWebCustomer.run(phoneRequest("uid-global", qr));
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
    await expect(checkInWebCustomer.run(phoneRequest("uid-global", qr))).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "POINT_COOLDOWN" },
    });
    await expect(
      checkInWebCustomer.run(phoneRequest("uid-global", signedBranchQr("salon-a", "branch-b"))),
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
    await checkInWebCustomer.run(phoneRequest("uid-global", qrA));

    await expect(checkInWebCustomer.run(phoneRequest("uid-global", qrB))).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("từ chối QR đã xoay và thay phiên active đã hết hạn bằng đúng một phiên mới", async () => {
    await seedSalon("salon-a", "branch-a");
    const oldQr = signedBranchQr("salon-a", "branch-a");
    const context = await getWebCustomerContext.run(phoneRequest("uid-global", oldQr));
    const first = await checkInWebCustomer.run(phoneRequest("uid-global", oldQr));

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
    const replacement = await checkInWebCustomer.run(phoneRequest("uid-global", currentQr));
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
    const checkedIn = await checkInWebCustomer.run(phoneRequest("uid-owner", qr));
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
