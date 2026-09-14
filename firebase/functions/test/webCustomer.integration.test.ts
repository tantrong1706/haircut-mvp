import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkInWebCustomer,
  getWebCustomerContext,
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSession,
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
    const refreshedA = await getWebCustomerContext.run(phoneRequest("uid-global", qrA));
    const refreshedB = await getWebCustomerContext.run(phoneRequest("uid-global", qrB));
    expect(refreshedA.customer.points).toBe(15);
    expect(refreshedB.customer.points).toBe(3);
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
    ).rejects.toMatchObject({ code: expect.stringMatching(/permission-denied|failed-precondition/) });

    await db.collection("branches").doc("branch-a").update({ isActive: false });
    await expect(
      getWebCustomerContext.run(phoneRequest("uid-global", valid)),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("double click và network retry chỉ tạo một active waiting session", async () => {
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
    expect(first.sessionStatus).toBe("waiting");
    expect((await db.collection("chair_sessions").get()).size).toBe(1);
    expect((await db.collection("active_service_sessions").get()).size).toBe(1);
    expect((await db.collection("point_requests").get()).size).toBe(0);
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

  it("không cho UID khác đọc session, lịch sử hoặc quà", async () => {
    await seedSalon("salon-a", "branch-a");
    const qr = signedBranchQr("salon-a", "branch-a");
    const owner = await getWebCustomerContext.run(phoneRequest("uid-owner", qr));
    const other = await getWebCustomerContext.run(
      phoneRequest("uid-other", qr, "+84909999999"),
    );
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
    await db.collection("lucky_wheel").doc("salon-a").set({
      configVersion: 1,
      requiredPoints: 5,
      deductPointsAfterSpin: true,
      rewardValidityDays: 30,
      slots: [
        { slotId: "slot-a", label: "Quà A", active: true, type: "reward", weight: 1 },
      ],
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
    expect((await db.collection("customers").doc(context.customer.customerId).get()).data()?.points)
      .toBe(5);
    expect((await db.collection("reward_history").get()).size).toBe(1);
    expect((await db.collection("customers").doc("customer-forged").get()).exists).toBe(false);
  });
});

async function seedSalon(salonId: string, branchId: string) {
  await Promise.all([
    db.collection("salons").doc(salonId).set({
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

function signedBranchQr(salonId: string, branchId: string) {
  return {
    qrType: "branch",
    salonId,
    branchId,
    qrToken: createSignedQrToken(secret, { kind: "branch", salonId, branchId, version: 1 }),
  };
}

function phoneRequest(
  uid: string,
  data: Record<string, unknown>,
  phone = "+84901234567",
) {
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
