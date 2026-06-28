import { createHash, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  AggregateField,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const functionOptions = { region: "asia-southeast1" };

type UserRole = "owner" | "staff";

type AppUser = {
  salonId: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  canRedeemRewards?: boolean;
};

type LuckyWheelSlot = {
  label: string;
  active: boolean;
};

type SpinWheelResult = {
  rewardId: string;
  rewardName: string;
  rewardCode: string;
  pointsAfter: number;
  selectedIndex: number;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `Thiếu trường bắt buộc: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Giá trị phải là chuỗi");
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} phải là đúng/sai`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new HttpsError("invalid-argument", `${field} phải là số dương`);
  }
  return Math.floor(value);
}

function currentUid(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Bạn cần đăng nhập");
  }
  return auth.uid;
}

async function getAppUser(uid: string): Promise<AppUser> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Không tìm thấy hồ sơ phân quyền");
  }
  const user = snap.data() as AppUser;
  if (!user.isActive) {
    throw new HttpsError("permission-denied", "Tài khoản đã bị tắt");
  }
  return user;
}

async function assertSalonRole(
  uid: string,
  salonId: string,
  allowedRoles: UserRole[],
): Promise<AppUser> {
  const user = await getAppUser(uid);
  if (user.salonId !== salonId || !allowedRoles.includes(user.role)) {
    throw new HttpsError("permission-denied", "Không có quyền với salon này");
  }
  return user;
}

function customerIdFor(salonId: string, zaloUserId: string): string {
  return createHash("sha256")
    .update(`${salonId}:${zaloUserId}`)
    .digest("hex")
    .slice(0, 40);
}

function last4(phone?: string): string | undefined {
  if (!phone) {
    return undefined;
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

function randomToken(bytes = 20): string {
  return randomBytes(bytes).toString("hex");
}

function rewardCode(seed?: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = seed
    ? createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase()
    : randomBytes(4).toString("hex").toUpperCase();
  return `HC-${date}-${suffix}`;
}

function miniAppUrl(salonId: string, mirrorId: string, qrToken: string): string {
  const params = new URLSearchParams({ salonId, mirrorId, qrToken });
  const miniAppId = process.env.ZALO_MINI_APP_ID || "your-mini-app-id";
  return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function startOfTodayBangkokMs(): number {
  const offsetMs = 7 * 60 * 60 * 1000;
  const now = new Date();
  const bangkokNow = new Date(now.getTime() + offsetMs);
  const startUtcMs = Date.UTC(
    bangkokNow.getUTCFullYear(),
    bangkokNow.getUTCMonth(),
    bangkokNow.getUTCDate(),
  );
  return startUtcMs - offsetMs;
}

async function spinWheelForCustomer(
  salonId: string,
  customerId: string,
): Promise<SpinWheelResult> {
  const wheelRef = db.collection("lucky_wheel").doc(salonId);
  const customerRef = db.collection("customers").doc(customerId);
  const rewardRef = db.collection("reward_history").doc();
  const now = Timestamp.now();

  let selectedReward = "";
  let selectedCode = "";
  let selectedIndex = 0;
  let pointsAfter = 0;

  await db.runTransaction(async (tx) => {
    const [wheelSnap, customerSnap] = await Promise.all([
      tx.get(wheelRef),
      tx.get(customerRef),
    ]);
    if (!wheelSnap.exists) {
      throw new HttpsError("not-found", "Vòng quay chưa được cấu hình");
    }
    if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy khách hàng");
    }

    const wheel = wheelSnap.data();
    const customer = customerSnap.data();
    const requiredPoints = Number(wheel?.requiredPoints ?? 5);
    const points = Number(customer?.points ?? 0);
    if (points < requiredPoints) {
      throw new HttpsError("failed-precondition", "Khách chưa đủ điểm để quay");
    }

    const activeSlots = (wheel?.slots ?? [])
      .filter((slot: LuckyWheelSlot) => slot.active && slot.label.trim().length > 0);
    if (activeSlots.length === 0) {
      throw new HttpsError("failed-precondition", "Vòng quay chưa có ô thưởng đang bật");
    }

    selectedIndex = Math.floor(Math.random() * activeSlots.length);
    selectedReward = activeSlots[selectedIndex].label;
    selectedCode = rewardCode(rewardRef.id);
    const deductPoints = Boolean(wheel?.deductPointsAfterSpin);
    pointsAfter = deductPoints ? points - requiredPoints : points;

    tx.set(rewardRef, {
      salonId,
      customerId,
      rewardName: selectedReward,
      rewardCode: selectedCode,
      selectedIndex,
      pointsSpent: deductPoints ? requiredPoints : 0,
      status: "unused",
      createdAt: now,
    });

    if (deductPoints) {
      tx.update(customerRef, {
        points: FieldValue.increment(-requiredPoints),
        updatedAt: now,
      });
    }
  });

  return {
    rewardId: rewardRef.id,
    rewardName: selectedReward,
    rewardCode: selectedCode,
    pointsAfter,
    selectedIndex,
  };
}

export const createSalon = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const name = requireString(request.data?.name, "name");
  const address = optionalString(request.data?.address);
  const phone = optionalString(request.data?.phone);

  const salonRef = db.collection("salons").doc();
  const userRef = db.collection("users").doc(uid);
  const wheelRef = db.collection("lucky_wheel").doc(salonRef.id);
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    tx.set(salonRef, {
      name,
      address: address ?? null,
      phone: phone ?? null,
      ownerId: uid,
      plan: "free",
      freeCustomerLimit: 50,
      pointPerVisit: 1,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(userRef, {
      salonId: salonRef.id,
      name,
      phone: phone ?? null,
      role: "owner",
      isActive: true,
      canRedeemRewards: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    tx.set(wheelRef, {
      salonId: salonRef.id,
      requiredPoints: 5,
      deductPointsAfterSpin: true,
      slots: [
        { label: "Giảm 10%", active: true },
        { label: "Gội đầu miễn phí", active: true },
        { label: "Tặng sáp tóc", active: true },
        { label: "Giảm 20%", active: true },
        { label: "Chúc bạn may mắn", active: true },
        { label: "Hấp dầu miễn phí", active: true },
      ],
      updatedAt: now,
    });
  });

  return { salonId: salonRef.id };
});

export const createStaffProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const staffUid = requireString(request.data?.uid, "uid");
  const name = requireString(request.data?.name, "name");
  const phone = optionalString(request.data?.phone);
  const canRedeemRewards = Boolean(request.data?.canRedeemRewards);
  const now = Timestamp.now();

  await db.collection("users").doc(staffUid).set({
    salonId,
    name,
    phone: phone ?? null,
    role: "staff",
    isActive: true,
    canRedeemRewards,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return { uid: staffUid };
});

export const createMirror = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const name = requireString(request.data?.name, "name");
  await assertSalonRole(uid, salonId, ["owner"]);

  const mirrorRef = db.collection("mirrors").doc();
  const qrToken = randomToken();
  const now = Timestamp.now();
  const qrUrl = miniAppUrl(salonId, mirrorRef.id, qrToken);

  await mirrorRef.set({
    salonId,
    name,
    qrToken,
    qrUrl,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return { mirrorId: mirrorRef.id, qrToken, qrUrl };
});

export const createManualCustomer = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = requireString(request.data?.name, "name");
  const phone = optionalString(request.data?.phone);
  const birthday = optionalString(request.data?.birthday);
  const allowPhoto = Boolean(request.data?.allowPhoto ?? false);
  const key = phone ? phone.replace(/\D/g, "") : randomToken(10);
  const customerId = createHash("sha256")
    .update(`${salonId}:manual:${key}`)
    .digest("hex")
    .slice(0, 40);
  const now = Timestamp.now();

  const customerRef = db.collection("customers").doc(customerId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(customerRef);
    const payload = {
      salonId,
      zaloUserId: null,
      source: "manual",
      name,
      phone: phone ?? null,
      phoneLast4: last4(phone) ?? null,
      birthday: birthday ?? null,
      allowPhoto,
      updatedAt: now,
      lastVisitAt: now,
    };

    if (snap.exists) {
      tx.set(customerRef, payload, { merge: true });
    } else {
      tx.set(customerRef, {
        ...payload,
        points: 0,
        createdAt: now,
      });
    }
  });

  return { customerId };
});

export const registerCustomerFromZalo = onCall(functionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const mirrorId = requireString(request.data?.mirrorId, "mirrorId");
  const qrToken = requireString(request.data?.qrToken, "qrToken");
  const zaloUserId = requireString(request.data?.zaloUserId, "zaloUserId");
  const name = requireString(request.data?.name, "name");
  const phone = optionalString(request.data?.phone);
  const birthday = optionalString(request.data?.birthday);
  const allowPhoto = requireBoolean(request.data?.allowPhoto, "allowPhoto");

  const mirrorSnap = await db.collection("mirrors").doc(mirrorId).get();
  if (!mirrorSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy QR gương");
  }
  const mirror = mirrorSnap.data();
  if (
    mirror?.salonId !== salonId ||
    mirror?.qrToken !== qrToken ||
    mirror?.isActive !== true
  ) {
    throw new HttpsError("permission-denied", "QR gương không hợp lệ");
  }

  const customerId = customerIdFor(salonId, zaloUserId);
  const customerRef = db.collection("customers").doc(customerId);
  const sessionRef = db.collection("chair_sessions").doc();
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const customerSnap = await tx.get(customerRef);
    const baseCustomer = {
      salonId,
      zaloUserId,
      name,
      phone: phone ?? null,
      phoneLast4: last4(phone) ?? null,
      birthday: birthday ?? null,
      allowPhoto,
      updatedAt: now,
      lastVisitAt: now,
    };

    if (customerSnap.exists) {
      tx.set(customerRef, baseCustomer, { merge: true });
    } else {
      tx.set(customerRef, {
        ...baseCustomer,
        points: 0,
        createdAt: now,
      });
    }

    tx.set(sessionRef, {
      salonId,
      mirrorId,
      customerId,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    });
  });

  const customerSnap = await customerRef.get();
  return {
    customerId,
    sessionId: sessionRef.id,
    points: customerSnap.data()?.points ?? 0,
  };
});

export const submitPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const note = optionalString(request.data?.note) ?? "";
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const staffName = optionalString(request.data?.staffName) ?? user.name;
  const pointsRequested = requirePositiveNumber(
    request.data?.pointsRequested ?? 1,
    "pointsRequested",
  );
  const photoUrls = Array.isArray(request.data?.photoUrls)
    ? request.data.photoUrls.filter((url: unknown) => typeof url === "string")
    : [];

  const sessionSnap = await db.collection("chair_sessions").doc(sessionId).get();
  if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
  }

  const session = sessionSnap.data();
  const now = Timestamp.now();
  const requestRef = db.collection("point_requests").doc();

  await requestRef.set({
    salonId,
    sessionId,
    customerId: session?.customerId,
    staffId: uid,
    staffName,
    note,
    photoUrls,
    pointsRequested,
    pointsAdded: pointsRequested,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  await sessionSnap.ref.set({
    status: "serving",
    updatedAt: now,
  }, { merge: true });

  return { requestId: requestRef.id };
});

export const approvePointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const requestRef = db.collection("point_requests").doc(requestId);
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const pointSnap = await tx.get(requestRef);
    if (!pointSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
    }
    const pointRequest = pointSnap.data();
    if (pointRequest?.salonId !== salonId) {
      throw new HttpsError("permission-denied", "Yêu cầu không thuộc salon này");
    }
    if (pointRequest?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Yêu cầu đã được xử lý");
    }

    const customerRef = db.collection("customers").doc(pointRequest.customerId);
    const recordRef = db.collection("haircut_records").doc();
    const sessionRef = db.collection("chair_sessions").doc(pointRequest.sessionId);
    const pointsAdded = Number(pointRequest.pointsRequested ?? pointRequest.pointsAdded ?? 1);

    if (!Number.isFinite(pointsAdded) || pointsAdded <= 0) {
      throw new HttpsError("failed-precondition", "Số điểm cộng không hợp lệ");
    }

    tx.update(customerRef, {
      points: FieldValue.increment(pointsAdded),
      lastVisitAt: now,
      updatedAt: now,
    });
    tx.update(requestRef, {
      status: "approved",
      approvedBy: uid,
      approvedAt: now,
      updatedAt: now,
    });
    tx.set(recordRef, {
      salonId,
      customerId: pointRequest.customerId,
      staffId: pointRequest.staffId,
      staffName: pointRequest.staffName ?? "",
      pointRequestId: requestId,
      note: pointRequest.note ?? "",
      photoUrls: pointRequest.photoUrls ?? [],
      pointsAdded,
      approvedBy: uid,
      createdAt: now,
    });
    tx.set(sessionRef, {
      status: "completed",
      updatedAt: now,
    }, { merge: true });
  });

  return { ok: true };
});

export const rejectPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  const reason = optionalString(request.data?.reason) ?? "";
  await assertSalonRole(uid, salonId, ["owner"]);

  const ref = db.collection("point_requests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
  }

  await ref.set({
    status: "rejected",
    rejectedBy: uid,
    rejectionReason: reason,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return { ok: true };
});

export const getOwnerOverview = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const startOfToday = Timestamp.fromMillis(startOfTodayBangkokMs());
  const [
    customersTodaySnap,
    pendingRequestsSnap,
    approvedPointsSnap,
    spinsTodaySnap,
    unusedRewardsSnap,
  ] = await Promise.all([
    db.collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", startOfToday)
      .count()
      .get(),
    db.collection("point_requests")
      .where("salonId", "==", salonId)
      .where("status", "==", "pending")
      .count()
      .get(),
    db.collection("point_requests")
      .where("salonId", "==", salonId)
      .where("status", "==", "approved")
      .where("approvedAt", ">=", startOfToday)
      .aggregate({
        total: AggregateField.sum("pointsAdded"),
      })
      .get(),
    db.collection("reward_history")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", startOfToday)
      .count()
      .get(),
    db.collection("reward_history")
      .where("salonId", "==", salonId)
      .where("status", "==", "unused")
      .count()
      .get(),
  ]);

  return {
    customersToday: customersTodaySnap.data().count,
    pendingRequests: pendingRequestsSnap.data().count,
    pointsApprovedToday: Number(approvedPointsSnap.data().total ?? 0),
    spinsToday: spinsTodaySnap.data().count,
    unusedRewards: unusedRewardsSnap.data().count,
  };
});

export const updateLuckyWheel = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const requiredPoints = requirePositiveNumber(
    request.data?.requiredPoints,
    "requiredPoints",
  );
  const deductPointsAfterSpin = requireBoolean(
    request.data?.deductPointsAfterSpin,
    "deductPointsAfterSpin",
  );
  const slots = request.data?.slots;
  if (!Array.isArray(slots) || slots.length !== 6) {
    throw new HttpsError("invalid-argument", "Vòng quay phải có đúng 6 ô");
  }
  const cleanedSlots: LuckyWheelSlot[] = slots.map((slot: unknown, index) => {
    if (
      typeof slot !== "object" ||
      slot === null ||
      typeof (slot as { label?: unknown }).label !== "string"
    ) {
      throw new HttpsError("invalid-argument", `Ô ${index + 1} không hợp lệ`);
    }
    return {
      label: (slot as { label: string }).label.trim(),
      active: Boolean((slot as { active?: boolean }).active ?? true),
    };
  });

  await db.collection("lucky_wheel").doc(salonId).set({
    salonId,
    requiredPoints,
    deductPointsAfterSpin,
    slots: cleanedSlots,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return { ok: true };
});

export const spinLuckyWheel = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  await assertSalonRole(uid, salonId, ["owner"]);

  return spinWheelForCustomer(salonId, customerId);
});

export const spinLuckyWheelFromZalo = onCall(functionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const zaloUserId = requireString(request.data?.zaloUserId, "zaloUserId");
  const customerId = customerIdFor(salonId, zaloUserId);

  return spinWheelForCustomer(salonId, customerId);
});

export const getCustomerHistoryFromZalo = onCall(functionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const zaloUserId = requireString(request.data?.zaloUserId, "zaloUserId");
  const customerId = customerIdFor(salonId, zaloUserId);
  const limit = Math.min(Number(request.data?.limit ?? 20), 50);

  const recordsSnap = await db.collection("haircut_records")
    .where("salonId", "==", salonId)
    .where("customerId", "==", customerId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const staffIds = [...new Set(recordsSnap.docs
    .map((doc) => doc.data().staffId)
    .filter((id): id is string => typeof id === "string" && id.length > 0))];
  const staffDocs = staffIds.length > 0
    ? await db.getAll(...staffIds.map((id) => db.collection("users").doc(id)))
    : [];
  const staffNames = new Map<string, string>();
  staffDocs.forEach((doc) => {
    const name = doc.data()?.name;
    if (doc.exists && typeof name === "string") {
      staffNames.set(doc.id, name);
    }
  });

  return {
    records: recordsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        createdAtMs: timestampMillis(data.createdAt),
        staffName: staffNames.get(data.staffId) ?? "Nhân viên",
        note: data.note ?? "",
        photoUrls: data.photoUrls ?? [],
        pointsAdded: data.pointsAdded ?? 0,
      };
    }),
  };
});

export const getCustomerRewardsFromZalo = onCall(functionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const zaloUserId = requireString(request.data?.zaloUserId, "zaloUserId");
  const customerId = customerIdFor(salonId, zaloUserId);
  const limit = Math.min(Number(request.data?.limit ?? 20), 50);

  const rewardsSnap = await db.collection("reward_history")
    .where("salonId", "==", salonId)
    .where("customerId", "==", customerId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return {
    rewards: rewardsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        rewardName: data.rewardName ?? "",
        rewardCode: data.rewardCode ?? "",
        status: data.status ?? "unused",
        createdAtMs: timestampMillis(data.createdAt),
      };
    }),
  };
});

export const redeemRewardCode = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const rewardCodeInput = requireString(request.data?.rewardCode, "rewardCode");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);

  if (user.role === "staff" && user.canRedeemRewards !== true) {
    throw new HttpsError("permission-denied", "Nhân viên chưa được phép xác nhận mã quà");
  }

  const query = await db.collection("reward_history")
    .where("salonId", "==", salonId)
    .where("rewardCode", "==", rewardCodeInput)
    .limit(1)
    .get();

  if (query.empty) {
    throw new HttpsError("not-found", "Không tìm thấy mã quà");
  }

  const rewardRef = query.docs[0].ref;
  const reward = query.docs[0].data();
  if (reward.status !== "unused") {
    throw new HttpsError("failed-precondition", "Mã quà đã được xử lý");
  }

  await rewardRef.set({
    status: "used",
    usedAt: Timestamp.now(),
    usedBy: uid,
  }, { merge: true });

  return { ok: true };
});
