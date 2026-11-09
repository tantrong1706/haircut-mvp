import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildNameSearchPrefixes } from "../src/customerSearch";
import {
  adjustSalonCustomerPoints,
  getSalonCustomerDetails,
  listRedeemableCustomerRewards,
  lookupRewardCode,
  redeemRewardCode,
  searchSalonCustomers,
} from "../src/index";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();

const SALON_A = "salon-a";
const SALON_B = "salon-b";
const BRANCH_A1 = "branch-a1";
const BRANCH_A2 = "branch-a2";
const BRANCH_B1 = "branch-b1";

describe("adversarial tenant access", () => {
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

  describe("owner manual point adjustment", () => {
    const input = { salonId: SALON_A, customerId: "customer-a1", expectedPoints: 6, delta: 2, reason: "Điều chỉnh nhầm điểm", idempotencyKey: "fixture-point-adjustment-1" };

    it("adds or subtracts once, records the reason and leaves the visit cooldown unchanged", async () => {
      const customer = db.doc("customers/customer-a1");
      const nextEligible = Timestamp.fromMillis(Date.now() + 60_000);
      await customer.update({ points: 6, nextPointEligibleAt: nextEligible });
      const first = await adjustSalonCustomerPoints.run(requestFor("owner-a", input));
      expect(first).toMatchObject({ pointsBefore: 6, pointsAfter: 8, currentPoints: 8, alreadyProcessed: false });
      const retry = await adjustSalonCustomerPoints.run(requestFor("owner-a", input));
      expect(retry).toMatchObject({ pointsAfter: 8, currentPoints: 8, alreadyProcessed: true });
      const subtract = await adjustSalonCustomerPoints.run(requestFor("owner-a", {
        ...input, expectedPoints: 8, delta: -3, idempotencyKey: "fixture-point-adjustment-2",
      }));
      expect(subtract.pointsAfter).toBe(5);
      expect((await customer.get()).data()?.nextPointEligibleAt.toMillis()).toBe(nextEligible.toMillis());
      const audit = await db.collection("audit_events").where("salonId", "==", SALON_A).where("action", "==", "customer.points_adjusted").get();
      expect(audit.size).toBe(2);
      expect(audit.docs.map((doc) => doc.data())).toContainEqual(expect.objectContaining({
        targetId: "customer-a1", actorUid: "owner-a", before: { points: 6 }, after: { points: 8 },
        metadata: { delta: 2, reason: input.reason },
      }));
      expect((await db.collection("point_requests").get()).size).toBe(0);
    });

    it("blocks staff, other salons, stale balance, missing reason, and negative balance", async () => {
      await db.doc("customers/customer-a1").update({ points: 6 });
      await expect(adjustSalonCustomerPoints.run(requestFor("staff-a1", input))).rejects.toMatchObject({ code: "permission-denied" });
      await expect(adjustSalonCustomerPoints.run(requestFor("owner-a", { ...input, customerId: "customer-b1" }))).rejects.toMatchObject({ code: "not-found" });
      await expect(adjustSalonCustomerPoints.run(requestFor("owner-a", { ...input, expectedPoints: 7 }))).rejects.toMatchObject({ code: "failed-precondition" });
      await expect(adjustSalonCustomerPoints.run(requestFor("owner-a", { ...input, reason: " " }))).rejects.toMatchObject({ code: "invalid-argument" });
      await expect(adjustSalonCustomerPoints.run(requestFor("owner-a", { ...input, delta: -7 }))).rejects.toMatchObject({ code: "failed-precondition" });
      expect((await db.doc("customers/customer-a1").get()).data()?.points).toBe(6);
    });
  });

  describe("redeem from customer search without a code", () => {
    const selection = {
      salonId: SALON_A,
      branchId: BRANCH_A1,
      customerId: "customer-a1",
      phoneLast4: "1111",
    };
    const redemption = {
      ...selection,
      rewardId: "reward-a1",
      idempotencyKey: "direct-redemption-fixture-1",
    };

    it("validates request identifiers and can look past a page of expired rewards", async () => {
      await expect(
        listRedeemableCustomerRewards.run(
          requestFor("owner-a", { ...selection, customerId: "unsafe/path" }),
        ),
      ).rejects.toMatchObject({ code: "invalid-argument" });
      await expect(
        listRedeemableCustomerRewards.run(
          requestFor("owner-a", { ...selection, phoneLast4: "11" }),
        ),
      ).rejects.toMatchObject({ code: "invalid-argument" });
      const batch = db.batch();
      for (let n = 0; n < 25; n += 1) {
        batch.set(db.doc(`reward_history/expired-${String(n).padStart(2, "0")}`), {
          salonId: SALON_A,
          customerId: "customer-a1",
          status: "unused",
          expiresAt: Timestamp.fromMillis(Date.now() - 1000),
        });
      }
      await batch.commit();
      const first = await listRedeemableCustomerRewards.run(requestFor("owner-a", selection));
      expect(first).toEqual({ rewards: [], nextCursor: "expired-24" });
      const next = await listRedeemableCustomerRewards.run(
        requestFor("owner-a", { ...selection, cursor: first.nextCursor }),
      );
      expect(next.rewards.map((reward) => reward.id)).toContain("reward-a1");
      expect(next.nextCursor).toBeNull();
    });

    it("redeems only the chosen customer's reward, safely replays a retry and never returns its code", async () => {
      const first = await redeemRewardCode.run(requestFor("staff-a1", redemption));
      expect(first).toMatchObject({
        rewardId: "reward-a1",
        alreadyRedeemed: false,
        usedBranchId: BRANCH_A1,
      });
      expect(first.rewardCode).toBe("");
      const retry = await redeemRewardCode.run(requestFor("staff-a1", redemption));
      expect(retry).toMatchObject({ rewardId: "reward-a1", alreadyRedeemed: true });
      await expect(
        redeemRewardCode.run(
          requestFor("staff-a1", { ...redemption, idempotencyKey: "direct-redemption-fixture-2" }),
        ),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    });

    it("lists only usable gifts without codes after the customer and branch are verified", async () => {
      await db
        .doc("reward_history/reward-a1-a2")
        .update({ redemptionScope: "branches", allowedBranchIds: [BRANCH_A2] });
      await seedReward(
        "reward-expired-direct",
        SALON_A,
        BRANCH_A1,
        "customer-a1",
        "HC-EXPIRED-DIRECT",
        Timestamp.now(),
        {
          expiresAt: Timestamp.fromMillis(Date.now() - 1000),
        },
      );
      const result = await listRedeemableCustomerRewards.run(requestFor("staff-a1", selection));
      expect(result.rewards).toEqual([expect.objectContaining({ id: "reward-a1" })]);
      expect(result.rewards[0]).not.toHaveProperty("rewardCode");
      await expect(
        listRedeemableCustomerRewards.run(requestFor("staff-a1-view-only", selection)),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        listRedeemableCustomerRewards.run(
          requestFor("staff-a1", { ...selection, branchId: BRANCH_A2 }),
        ),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        listRedeemableCustomerRewards.run(
          requestFor("owner-a", { ...selection, phoneLast4: "9999" }),
        ),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        listRedeemableCustomerRewards.run(
          requestFor("owner-a", { ...selection, customerId: "customer-b1", phoneLast4: "3333" }),
        ),
      ).rejects.toMatchObject({ code: "not-found" });
    });

    it("does not redeem a different customer's reward, a wrong suffix, or a restricted reward", async () => {
      await expect(
        redeemRewardCode.run(requestFor("owner-a", { ...redemption, rewardId: "reward-a2" })),
      ).rejects.toMatchObject({ code: "failed-precondition" });
      await expect(
        redeemRewardCode.run(requestFor("staff-a1", { ...redemption, phoneLast4: "9999" })),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        redeemRewardCode.run(requestFor("staff-a1-view-only", redemption)),
      ).rejects.toMatchObject({ code: "permission-denied" });
      await expect(
        redeemRewardCode.run(
          requestFor("staff-a1", {
            ...redemption,
            customerId: "customer-a2",
            phoneLast4: "2222",
            rewardId: "reward-restricted-a2",
          }),
        ),
      ).rejects.toMatchObject({ code: "failed-precondition" });
      expect((await db.doc("reward_history/reward-a1").get()).data()?.status).toBe("unused");
    });
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

    it("does not expose a customer from another salon", async () => {
      const [ownerResult, staffResult] = await Promise.all([
        searchSalonCustomers.run(requestFor("owner-a", { salonId: SALON_A, term: "3333" })),
        searchSalonCustomers.run(
          requestFor("staff-a1", {
            salonId: SALON_A,
            branchId: BRANCH_A1,
            term: "3333",
          }),
        ),
      ]);

      expect(ownerResult.customers).toEqual([]);
      expect(staffResult.customers).toEqual([]);
    });

    it("keeps a moved customer searchable while restricting branch data", async () => {
      const phoneResult = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "1111",
        }),
      );
      const nameResult = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "customer a1",
        }),
      );

      for (const result of [phoneResult, nameResult]) {
        expect(result.customers).toHaveLength(1);
        expect(result.customers[0]).toMatchObject({
          id: "customer-a1",
          phoneLast4: "1111",
          detailsLoaded: false,
        });
        expect(result.customers[0]).not.toHaveProperty("phone");
        expect(result.customers[0].recentRecords).toEqual([]);
        expect(result.customers[0].branchVisits).toEqual([]);
        expect(result.customers[0].rewardHistory).toEqual([]);
        expect(result.customers[0].unusedRewards).toEqual([]);
      }

      const details = await getSalonCustomerDetails.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          customerId: "customer-a1",
        }),
      );
      expect(details.customer.recentRecords).toEqual([
        expect.objectContaining({
          id: "record-a1",
          branchId: BRANCH_A1,
          note: "A1 note",
          photoUrls: [],
        }),
      ]);
      expect(details.customer.recentRecords).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ note: "A2 private note" })]),
      );
      expect(details.customer.branchVisits).toEqual([]);
      expect(details.customer.rewardHistory).toEqual([]);
      expect(details.customer.unusedRewards).toEqual([
        expect.objectContaining({ id: "reward-a1", branchId: BRANCH_A1, rewardCode: "HC-A1" }),
      ]);
      expect(details.customer.unusedRewards).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "reward-a1-a2" })]),
      );
    });

    it("returns shared customer data without exposing another branch's business data", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "2222",
        }),
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({ id: "customer-a2", phoneLast4: "2222" });
      expect(result.customers[0]).not.toHaveProperty("phone");
      expect(result.customers[0].recentRecords).toEqual([]);
      expect(result.customers[0].branchVisits).toEqual([]);
      expect(result.customers[0].rewardHistory).toEqual([]);
      expect(result.customers[0].unusedRewards).toEqual([]);

      const details = await getSalonCustomerDetails.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          customerId: "customer-a2",
        }),
      );
      expect(details.customer.recentRecords).toEqual([]);
      expect(details.customer.unusedRewards).toEqual([]);
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

      const details = await getSalonCustomerDetails.run(
        requestFor("staff-a1-view-only", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          customerId: "customer-a1",
        }),
      );
      expect(details.customer.unusedRewards).toEqual([]);
    });

    it("keeps legacy customers without lastBranchId searchable and branch-scoped", async () => {
      const result = await searchSalonCustomers.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "4444",
        }),
      );

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toMatchObject({ id: "customer-legacy", phoneLast4: "4444" });
      expect(result.customers[0]).not.toHaveProperty("phone");
      expect(result.customers[0].recentRecords).toEqual([]);

      const details = await getSalonCustomerDetails.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          customerId: "customer-legacy",
        }),
      );
      expect(details.customer.recentRecords).toEqual([
        expect.objectContaining({
          id: "record-legacy-a1",
          branchId: BRANCH_A1,
          note: "Legacy A1 note",
        }),
      ]);
      expect(details.customer.recentRecords).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ note: "Legacy A2 private note" })]),
      );
      expect(details.customer.unusedRewards).toEqual([]);
    });

    it("keeps full owner history and supports branch-scoped owner views", async () => {
      const salonResult = await searchSalonCustomers.run(
        requestFor("owner-a", { salonId: SALON_A, term: "1111" }),
      );
      const branchResult = await searchSalonCustomers.run(
        requestFor("owner-a", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          term: "1111",
        }),
      );
      const salonDetails = await getSalonCustomerDetails.run(
        requestFor("owner-a", { salonId: SALON_A, customerId: "customer-a1" }),
      );
      const branchDetails = await getSalonCustomerDetails.run(
        requestFor("owner-a", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          customerId: "customer-a1",
        }),
      );

      expect(salonResult.customers).toHaveLength(1);
      expect(salonResult.customers[0].recentRecords).toEqual([]);
      expect(salonDetails.customer.recentRecords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "record-a1", branchId: BRANCH_A1 }),
          expect.objectContaining({ id: "record-a1-a2", branchId: BRANCH_A2 }),
        ]),
      );
      expect(salonDetails.customer.branchVisits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ branchId: BRANCH_A1 }),
          expect.objectContaining({ branchId: BRANCH_A2 }),
        ]),
      );
      expect(salonDetails.customer.rewardHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "reward-a1", rewardCode: "HC-A1" }),
          expect.objectContaining({ id: "reward-a1-a2", rewardCode: "HC-A1-A2" }),
        ]),
      );

      expect(branchResult.customers).toHaveLength(1);
      expect(branchDetails.customer.recentRecords).toEqual([
        expect.objectContaining({ id: "record-a1", branchId: BRANCH_A1 }),
      ]);
      expect(branchDetails.customer.branchVisits).toEqual([
        expect.objectContaining({ branchId: BRANCH_A1 }),
      ]);
      expect(branchDetails.customer.rewardHistory).toEqual([
        expect.objectContaining({ id: "reward-a1", rewardCode: "HC-A1" }),
      ]);
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

    it("allows a salon-wide reward from another branch in the same salon", async () => {
      const result = await lookupRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-A2",
        }),
      );

      expect(result).toMatchObject({
        found: true,
        status: "unused",
        sourceBranchId: BRANCH_A2,
        redemptionScope: "salon",
        redeemableAtBranch: true,
        reason: "OK",
      });
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
        requestFor("owner-a", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-B1",
        }),
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
        requestFor("owner-a", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-UNKNOWN",
        }),
      );
      const otherSalon = await lookupRewardCode.run(
        requestFor("owner-a", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-B1",
        }),
      );

      expect(pickLookupStatus(unknown)).toEqual(pickLookupStatus(otherSalon));
    });
  });

  describe("redeemRewardCode", () => {
    it("allows salon-wide redemption at another active branch in the same salon", async () => {
      const result = await redeemRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-A2",
          idempotencyKey: "cross-branch-redeem-0001",
        }),
      );

      expect(result).toMatchObject({ usedBranchId: BRANCH_A1, alreadyRedeemed: false });
      expect((await db.collection("reward_history").doc("reward-a2").get()).data()).toMatchObject({
        status: "used",
        usedBranchId: BRANCH_A1,
      });
    });

    it("rejects a branch-restricted reward during lookup and redeem", async () => {
      const lookup = await lookupRewardCode.run(
        requestFor("staff-a1", {
          salonId: SALON_A,
          branchId: BRANCH_A1,
          rewardCode: "HC-RESTRICTED-A2",
        }),
      );
      expect(lookup).toMatchObject({
        found: true,
        redeemableAtBranch: false,
        reason: "WRONG_BRANCH",
      });
      await expect(
        redeemRewardCode.run(
          requestFor("staff-a1", {
            salonId: SALON_A,
            branchId: BRANCH_A1,
            rewardCode: "HC-RESTRICTED-A2",
            idempotencyKey: "restricted-redeem-0001",
          }),
        ),
      ).rejects.toMatchObject({ details: { errorCode: "INVALID_BRANCH" } });
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
    seedCustomer("customer-a1", SALON_A, BRANCH_A2, "1111"),
    seedCustomer("customer-a2", SALON_A, BRANCH_A2, "2222"),
    seedCustomer("customer-b1", SALON_B, BRANCH_B1, "3333"),
    seedCustomer("customer-legacy", SALON_A, undefined, "4444"),
  ]);
  await Promise.all([
    seedRecord("record-a1", SALON_A, BRANCH_A1, "customer-a1", "A1 note", now),
    seedRecord(
      "record-a1-a2",
      SALON_A,
      BRANCH_A2,
      "customer-a1",
      "A2 private note",
      Timestamp.fromMillis(now.toMillis() + 1),
    ),
    seedRecord("record-a2", SALON_A, BRANCH_A2, "customer-a2", "A2 note", now),
    seedRecord("record-legacy-a1", SALON_A, BRANCH_A1, "customer-legacy", "Legacy A1 note", now),
    seedRecord(
      "record-legacy-a2",
      SALON_A,
      BRANCH_A2,
      "customer-legacy",
      "Legacy A2 private note",
      Timestamp.fromMillis(now.toMillis() + 1),
    ),
    seedReward("reward-a1", SALON_A, BRANCH_A1, "customer-a1", "HC-A1", now),
    seedReward(
      "reward-a1-a2",
      SALON_A,
      BRANCH_A2,
      "customer-a1",
      "HC-A1-A2",
      Timestamp.fromMillis(now.toMillis() + 1),
    ),
    seedReward("reward-a2", SALON_A, BRANCH_A2, "customer-a2", "HC-A2", now),
    seedReward("reward-restricted-a2", SALON_A, BRANCH_A2, "customer-a2", "HC-RESTRICTED-A2", now, {
      redemptionScope: "branches",
      allowedBranchIds: [BRANCH_A2],
    }),
    seedReward("reward-b1", SALON_B, BRANCH_B1, "customer-b1", "HC-B1", now),
    seedReward("reward-legacy-a2", SALON_A, BRANCH_A2, "customer-legacy", "HC-LEGACY-A2", now),
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
  lastBranchId: string | undefined,
  phoneLast4: string,
) {
  const name = customerId.replaceAll("-", " ");
  return db
    .collection("customers")
    .doc(customerId)
    .set({
      salonId,
      name,
      namePrefixes: buildNameSearchPrefixes(name),
      phoneLast4,
      points: 1,
      allowPhoto: false,
      ...(lastBranchId ? { lastBranchId } : {}),
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
  extra: Record<string, unknown> = {},
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
      ...extra,
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
