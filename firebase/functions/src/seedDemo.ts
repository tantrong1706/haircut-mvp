import { createHash, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();

function customerIdFor(salonId: string, zaloUserId: string): string {
  return createHash("sha256").update(`${salonId}:${zaloUserId}`).digest("hex").slice(0, 40);
}

function token() {
  return randomBytes(20).toString("hex");
}

async function main() {
  const now = Timestamp.now();
  const ownerId = "demo-owner";
  const staffId = "demo-staff";
  const salonId = "demo-salon";
  const branchId = "demo-branch-main";
  const mirrorId = "demo-mirror-1";
  const qrToken = "demo-token";
  const zaloUserId = "demo-zalo-user";
  const customerId = customerIdFor(salonId, zaloUserId);
  const recordId = "demo-record-1";

  await db.collection("salons").doc(salonId).set({
    name: "HAIRCUT Demo Salon",
    address: "Demo street",
    phone: "0900000000",
    ownerId,
    plan: "free",
    freeCustomerLimit: 50,
    pointPerVisit: 1,
    defaultBranchId: branchId,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("branches").doc(branchId).set({
    salonId,
    name: "Chi nhánh trung tâm",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("users").doc(ownerId).set({
    salonId,
    name: "Chu salon",
    role: "owner",
    isActive: true,
    canRedeemRewards: true,
    canAwardPointsDirectly: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("users").doc(staffId).set({
    salonId,
    name: "Nam",
    role: "staff",
    isActive: true,
    canRedeemRewards: true,
    canAwardPointsDirectly: true,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .collection("mirrors")
    .doc(mirrorId)
    .set({
      salonId,
      name: "Gương số 1",
      qrToken,
      qrUrl: `http://127.0.0.1:5173/?salonId=${salonId}&mirrorId=${mirrorId}&qrToken=${qrToken}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

  await db.collection("customers").doc(customerId).set({
    salonId,
    zaloUserId,
    name: "Nguyễn Văn A",
    phone: "0900001234",
    phoneLast4: "1234",
    points: 5,
    allowPhoto: true,
    createdAt: now,
    updatedAt: now,
    lastVisitAt: now,
  });

  await db.collection("haircut_records").doc(recordId).set({
    salonId,
    customerId,
    staffId,
    pointRequestId: "demo-request-1",
    note: "Fade thấp, để mái dài, không cắt quá cao",
    photoUrls: [],
    pointsAdded: 1,
    approvedBy: ownerId,
    createdAt: now,
  });

  await db
    .collection("lucky_wheel")
    .doc(salonId)
    .set({
      salonId,
      configVersion: 1,
      requiredPoints: 5,
      rewardValidityDays: 90,
      deductPointsAfterSpin: true,
      slots: [
        { slotId: "slot-1", label: "Giảm 10%", active: true, type: "reward", weight: 25 },
        {
          slotId: "slot-2",
          label: "Gội đầu miễn phí",
          active: true,
          type: "reward",
          weight: 10,
        },
        { slotId: "slot-3", label: "Tặng sáp tóc", active: true, type: "reward", weight: 10 },
        { slotId: "slot-4", label: "Giảm 20%", active: true, type: "reward", weight: 5 },
        {
          slotId: "slot-5",
          label: "Chúc bạn may mắn",
          active: true,
          type: "no_prize",
          weight: 40,
        },
        {
          slotId: "slot-6",
          label: "Hấp dầu miễn phí",
          active: true,
          type: "reward",
          weight: 10,
        },
      ],
      updatedAt: now,
    });

  await db
    .collection("reward_history")
    .doc("demo-reward-1")
    .set({
      salonId,
      customerId,
      sourceBranchId: branchId,
      sourceBranchName: "Chi nhánh trung tâm",
      sourceSlotId: "slot-1",
      wheelConfigVersion: 1,
      wheelSlotWeight: 25,
      rewardName: "Giảm 10%",
      rewardCode: `HC-${token().slice(0, 4).toUpperCase()}`,
      pointsSpent: 5,
      redemptionScope: "salon",
      status: "unused",
      createdAt: now,
    });

  console.log("Demo data seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
