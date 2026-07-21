import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { lookupRewardCode, redeemRewardCode, searchSalonCustomers } from "../src/index";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || "demo-haircut-security-fix";
const db = getFirestore();

const SALON_A = "salon-a";
const SALON_B = "salon-b";
const BRANCH_A1 = "branch-a1";
const BRANCH_A2 = "branch-a2";
const BRANCH_B1 = "branch-b1";

describe.skipIf(!emulatorHost)("adversarial tenant access", () => {
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Cannot clear Firestore emulator: HTTP ${response.status}`);
    }
    await seedFixture();
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  describe("searchSalonCustomers", () => {
    it("allows an owner to search customers in the authenticated salon", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("owner-a", { salonId: SALON_A, term: "1111" }),
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({ id: "customer-a1", phoneLast4: "1111" });
    });

    it("rejects an owner who submits another salon id", async () => {
      await expect(
        searchSalonCustomers.run(requestFor("owner-a", { salonId: SALON_B, term: "3333" })),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("allows staff to search the assigned branch", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "1111",
        }),
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({ id: "customer-a1", phoneLast4: "1111" });
      expect(result.customers[0].recentRecords).toHaveLength(1);
      expect(result.customers[0].unusedRewards).toHaveLength(1);
    });

    it("does not return a customer from another branch through an allowed scope", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "2222",
        }),
      );

      expect(result.customers).toEqual([]);
    });

    it("does not expose reward codes to staff without redemption permission", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("staff-a1-view-only", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "1111",
        }),
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].unusedRewards).toEqual([]);
    });

    it("rejects staff that submits an unassigned branch", async () => {
      await expect(
        searchSalonCustomers.run(
          requestFor("staff-a1", {
            salonId: SALON_A,
            branchId: BRANCH_A2,
            term: "2222",
          }),
        ),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("rejects a non-manager user", async () => {
      await expect(
        searchSalonCustomers.run(
          requestFor("customer-user", {
            salonId: SALON_A,
            branchId: BRANCH_A1,
            term: "1111",
          }),
        ),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("rejects an unauthenticated caller", async () => {
      await expect(
        searchSalonCustomers.run(
          unauthenticatedRequest({ salonId: SALON_A, branchId: BRANCH_A1, term: "1111" }),
        ),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    });
  });

  describe("lookupRewardCode", () => {
    it("allows staff to inspect a reward in the assigned branch", async () => {
      const result = await lookupRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-A1",
        }),
      );

      expect(result).toMatchObject({
        found: true,
        rewardId: "reward-a1",
        rewardCode: "HC-A1",
      });
    });

    it("does not expose a reward from another branch", async () => {
      const result = await lookupRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-A2",
        }),
      );

      expect(result).toMatchObject({ found: false, status: "not_found" });
      expect(result).not.toHaveProperty("customerName");
    });

    it("does not expose a reward from another salon to staff", async () => {
      const result = await lookupRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-B1",
        }),
      );

      expect(result).toMatchObject({ found: false, status: "not_found" });
    });

    it("does not expose a reward from another salon to an owner", async () => {
      const result = await lookupRewardCode.run(
        requestFor("owner-a", { salonId: SALON_A, rewardCode: "HC-B1" }),
      );

      expect(result).toMatchObject({ found: false, status: "not_found" });
    });

    it("rejects a non-manager user", async () => {
      await expect(
        lookupRewardCode.run(
          requestFor("customer-user", {
            salonId: SALON_A,
            branchId: BRANCH_A1,
            rewardCode: "HC-A1",
          }),
        ),
      ).rejects.toMatchObject({ code: "permission-denied" });
    });

    it("rejects an unauthenticated caller", async () => {
      await expect(
        lookupRewardCode.run(
          unauthenticatedRequest({
            salonId: SALON_A,
            branchId: BRANCH_A1,
            rewardCode: "HC-A1",
          }),
        ),
      ).rejects.toMatchObject({ code: "unauthenticated" });
    });

    it("returns the same public status for an unknown and an out-of-salon code", async () => {
      const unknown = await lookupRewardCode.run(
        requestFor("owner-a", { salonId: SALON_A, rewardCode: "HC-UNKNOWN" }),
      );
      const otherSalon = await lookupRewardCode.run(
        requestFor("owner-a", { salonId: SALON_A, rewardCode: "HC-B1" }),
      );

      expect(pickLookupStatus(unknown)).toEqual(pickLookupStatus(otherSalon));
    });
  });

  describe("redeemRewardCode", () => {
    it("prevents cross-branch redemption", async () => {
      await expect(
        redeemRewardCode.run(
          requestFor("staff-a1", {
            salonId: SALON_A,
            branchId: BRANCH_A1,
            rewardCode: "HC-A2",
            idempotencyKey: "cross-branch-redeem-0001",
          }),
        ),
      ).rejects.toMatchObject({ code: "not-found" });

      expect((await db.collection("reward_history").doc("reward-a2").get()).data()?.status).toBe(
        "unused",
      );
    });

    it("keeps a repeated redemption idempotent", async () => {
      const input = {
        salonId: SALON_A,
        branchId: BRANCH_A1,
        rewardCode: "HC-A1",
        idempotencyKey: "same-redeem-request-0001",
      };
      const first = await redeemRewardCode.run(requestFor("staff-a1", input));
      const repeated = await redeemRewardCode.run(requestFor("staff-a1", input));

      expect(first.alreadyRedeemed).toBe(false);
      expect(repeated.alreadyRedeemed).toBe(true);
      expect((await db.collection("reward_history").doc("reward-a1").get()).data()).toMatchObject({
        status: "used",
        usedBranchId: BRANCH_A1,
      });
    });
  });
});

async function seedFixture() {
  const now = Timestamp.now();
  await Promise.all([
    db.collection("salons").doc(SALON_A).set({
      name: "Salon A",
      ownerId: "owner-a",
      status: "active",
      isActive: true,
    }),
    db.collection("salons").doc(SALON_B).set({
      name: "Salon B",
      ownerId: "owner-b",
      status: "active",
      isActive: true,
    }),
    seedBranch(SALON_A, BRANCH_A1),
    seedBranch(SALON_A, BRANCH_A2),
    seedBranch(SALON_B, BRANCH_B1),
    seedUser("owner-a", SALON_A, "owner", []),
    seedUser("owner-b", SALON_B, "owner", []),
    seedUser("staff-a1", SALON_A, "staff", [BRANCH_A1], true),
    seedUser("staff-a1-view-only", SALON_A, "staff", [BRANCH_A1]),
    seedUser("customer-user", SALON_A, "customer", []),
    seedCustomer("customer-a1", SALON_A, BRANCH_A1, "1111"),
    seedCustomer("customer-a2", SALON_A, BRANCH_A2, "2222"),
    seedCustomer("customer-b1", SALON_B, BRANCH_B1, "3333"),
  ]);
  await Promise.all([
    seedRecord("record-a1", SALON_A, BRANCH_A1, "customer-a1", "A1 note", now),
    seedRecord("record-a2", SALON_A, BRANCH_A2, "customer-a2", "A2 note", now),
    seedReward("reward-a1", SALON_A, BRANCH_A1, "customer-a1", "HC-A1", now),
    seedReward("reward-a2", SALON_A, BRANCH_A2, "customer-a2", "HC-A2", now),
    seedReward("reward-b1", SALON_B, BRANCH_B1, "customer-b1", "HC-B1", now),
  ]);
}

function seedBranch(salonId: string, branchId: string) {
  return db.collection("branches").doc(branchId).set({
    salonId,
    name: branchId,
    isActive: true,
  });
}

function seedUser(
  uid: string,
  salonId: string,
  role: string,
  branchIds: string[],
  canRedeemRewards = false,
) {
  return db
    .collection("users")
    .doc(uid)
    .set({
      salonId,
      role,
      name: uid,
      isActive: true,
      branchId: branchIds[0] ?? null,
      branchIds,
      canRedeemRewards,
    });
}

function seedCustomer(
  customerId: string,
  salonId: string,
  lastBranchId: string,
  phoneLast4: string,
) {
  return db.collection("customers").doc(customerId).set({
    salonId,
    name: customerId,
    phoneLast4,
    points: 1,
    allowPhoto: false,
    lastBranchId,
    lastVisitAt: Timestamp.now(),
  });
}

function seedRecord(
  recordId: string,
  salonId: string,
  branchId: string,
  customerId: string,
  note: string,
  createdAt: Timestamp,
) {
  return db.collection("haircut_records").doc(recordId).set({
    salonId,
    branchId,
    customerId,
    note,
    staffName: "Staff",
    pointsAdded: 1,
    createdAt,
  });
}

function seedReward(
  rewardId: string,
  salonId: string,
  branchId: string,
  customerId: string,
  rewardCode: string,
  createdAt: Timestamp,
) {
  return db
    .collection("reward_history")
    .doc(rewardId)
    .set({
      salonId,
      branchId,
      customerId,
      rewardCode,
      rewardName: "Test reward",
      status: "unused",
      createdAt,
      expiresAt: Timestamp.fromMillis(createdAt.toMillis() + 60_000),
    });
}

function requestFor(uid: string, data: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token: {} },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}

function unauthenticatedRequest(data: Record<string, unknown>) {
  return {
    data,
    auth: undefined,
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}

function pickLookupStatus(result: { found: boolean; status: string }) {
  return { found: result.found, status: result.status };
}
