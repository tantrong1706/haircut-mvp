import { createHash, createHmac, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  AggregateField,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const storage = getStorage();
const functionOptions = { region: "asia-southeast1" };
const SESSION_POINT_REQUEST_WINDOW_MS = 12 * 60 * 60 * 1000;

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

type ZaloProfile = {
  zaloUserId: string;
  name?: string;
  avatar?: string;
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

function avatarUrlString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Avatar phải là đường dẫn ảnh");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length > 500) {
    throw new HttpsError("invalid-argument", "Đường dẫn avatar quá dài");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpsError("invalid-argument", "Đường dẫn avatar không hợp lệ");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpsError("invalid-argument", "Avatar phải dùng link http hoặc https");
  }

  return trimmed;
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

function activeSessionRefFor(salonId: string, customerId: string) {
  const id = createHash("sha256")
    .update(`${salonId}:${customerId}`)
    .digest("hex")
    .slice(0, 40);
  return db.collection("active_service_sessions").doc(id);
}

async function verifyZaloAccessToken(accessTokenInput: unknown): Promise<ZaloProfile> {
  const accessToken = requireString(accessTokenInput, "zaloAccessToken");
  const appSecret = process.env.ZALO_APP_SECRET || process.env.ZALO_SECRET_KEY || "";

  if (!appSecret || appSecret.includes("your-")) {
    throw new HttpsError(
      "failed-precondition",
      "Thiếu ZALO_APP_SECRET để xác minh danh tính Zalo ở server",
    );
  }

  const appsecretProof = createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
  const endpoint = new URL(process.env.ZALO_PROFILE_ENDPOINT || "https://graph.zalo.me/v2.0/me");
  endpoint.searchParams.set("fields", "id,name,picture");

  let payload: Record<string, unknown>;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        access_token: accessToken,
        appsecret_proof: appsecretProof,
      },
    });

    payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(payload.message ?? response.statusText));
    }
  } catch (error) {
    throw new HttpsError(
      "unauthenticated",
      error instanceof Error ? error.message : "Không xác minh được Zalo access token",
    );
  }

  const errorCode = Number(payload.error ?? 0);
  if (Number.isFinite(errorCode) && errorCode !== 0) {
    throw new HttpsError(
      "unauthenticated",
      String(payload.message ?? "Zalo access token không hợp lệ"),
    );
  }

  const zaloUserId = String(payload.id ?? "").trim();
  if (!zaloUserId) {
    throw new HttpsError("unauthenticated", "Zalo không trả về user id hợp lệ");
  }

  const picture = payload.picture as { data?: { url?: unknown } } | undefined;

  return {
    zaloUserId,
    name: optionalString(payload.name),
    avatar: optionalString(picture?.data?.url),
  };
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

function isFreshServiceSession(createdAt: unknown, now: Timestamp): boolean {
  const createdAtMs = timestampMillis(createdAt);

  if (!createdAtMs) {
    return false;
  }

  const nowMs = now.toMillis();
  return createdAtMs <= nowMs + 5 * 60 * 1000 &&
    nowMs - createdAtMs <= SESSION_POINT_REQUEST_WINDOW_MS;
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
  const ownerName = optionalString(request.data?.ownerName) ?? name;
  const address = optionalString(request.data?.address);
  const phone = optionalString(request.data?.phone);

  const salonRef = db.collection("salons").doc();
  const userRef = db.collection("users").doc(uid);
  const wheelRef = db.collection("lucky_wheel").doc(salonRef.id);
  const mirrorRef = db.collection("mirrors").doc();
  const qrToken = randomToken();
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
      name: ownerName,
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
    tx.set(mirrorRef, {
      salonId: salonRef.id,
      name: "Gương 1",
      qrToken,
      qrUrl: miniAppUrl(salonRef.id, mirrorRef.id, qrToken),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    salonId: salonRef.id,
    mirrorId: mirrorRef.id,
    qrUrl: miniAppUrl(salonRef.id, mirrorRef.id, qrToken),
  };
});

export const createStaffProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const staffUidInput = optionalString(request.data?.uid);
  const email = optionalString(request.data?.email)?.toLowerCase();
  const password = optionalString(request.data?.password);
  const name = requireString(request.data?.name, "name");
  const phone = optionalString(request.data?.phone);
  const canRedeemRewards = Boolean(request.data?.canRedeemRewards);
  const now = Timestamp.now();
  let staffUid = staffUidInput;

  if (!staffUid) {
    if (!email) {
      throw new HttpsError("invalid-argument", "Thiếu email nhân viên");
    }
    if (!password || password.length < 6) {
      throw new HttpsError("invalid-argument", "Mật khẩu nhân viên phải có ít nhất 6 ký tự");
    }

    try {
      const userRecord = await getAuth().createUser({
        email,
        password,
        displayName: name,
        disabled: false,
      });
      staffUid = userRecord.uid;
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
      if (code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Email nhân viên đã có tài khoản Auth");
      }
      throw new HttpsError("internal", "Không tạo được tài khoản nhân viên");
    }
  }

  await db.collection("users").doc(staffUid).set({
    salonId,
    name,
    email: email ?? null,
    phone: phone ?? null,
    role: "staff",
    isActive: true,
    canRedeemRewards,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  return { uid: staffUid, email: email ?? "" };
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

export const updateMirror = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const mirrorId = requireString(request.data?.mirrorId, "mirrorId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = optionalString(request.data?.name);
  const isActive = typeof request.data?.isActive === "boolean"
    ? request.data.isActive
    : undefined;
  const regenerateQr = Boolean(request.data?.regenerateQr);
  const mirrorRef = db.collection("mirrors").doc(mirrorId);
  const mirrorSnap = await mirrorRef.get();

  if (!mirrorSnap.exists || mirrorSnap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy gương/ghế");
  }

  const payload: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (name) {
    payload.name = name;
  }
  if (isActive !== undefined) {
    payload.isActive = isActive;
  }
  if (regenerateQr) {
    const qrToken = randomToken();
    payload.qrToken = qrToken;
    payload.qrUrl = miniAppUrl(salonId, mirrorId, qrToken);
  }

  await mirrorRef.set(payload, { merge: true });
  const updatedSnap = await mirrorRef.get();
  const mirror = updatedSnap.data();

  return {
    mirrorId,
    name: mirror?.name ?? "",
    qrToken: mirror?.qrToken ?? "",
    qrUrl: mirror?.qrUrl ?? "",
    isActive: Boolean(mirror?.isActive),
  };
});

export const updateStaffProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const staffUid = requireString(request.data?.uid, "uid");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = optionalString(request.data?.name);
  const phone = optionalString(request.data?.phone);
  const isActive = typeof request.data?.isActive === "boolean"
    ? request.data.isActive
    : undefined;
  const canRedeemRewards = typeof request.data?.canRedeemRewards === "boolean"
    ? request.data.canRedeemRewards
    : undefined;
  const staffRef = db.collection("users").doc(staffUid);
  const staffSnap = await staffRef.get();

  if (!staffSnap.exists || staffSnap.data()?.salonId !== salonId || staffSnap.data()?.role !== "staff") {
    throw new HttpsError("not-found", "Không tìm thấy nhân viên");
  }

  const payload: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (name) {
    payload.name = name;
  }
  if (phone !== undefined) {
    payload.phone = phone;
  }
  if (isActive !== undefined) {
    payload.isActive = isActive;
  }
  if (canRedeemRewards !== undefined) {
    payload.canRedeemRewards = canRedeemRewards;
  }

  await staffRef.set(payload, { merge: true });

  return { uid: staffUid };
});

export const updateOwnerAvatar = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const avatarUrl = avatarUrlString(request.data?.avatarUrl);
  const now = Timestamp.now();

  await db.collection("users").doc(uid).set({
    avatarUrl: avatarUrl || null,
    updatedAt: now,
  }, { merge: true });

  await getAuth().updateUser(uid, {
    photoURL: avatarUrl || null,
  });

  return { avatarUrl };
});

export const getSalonProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const salonSnap = await db.collection("salons").doc(salonId).get();
  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  const salon = salonSnap.data();
  return {
    id: salonSnap.id,
    name: salon?.name ?? "Salon",
    address: salon?.address ?? "",
    phone: salon?.phone ?? "",
    pointPerVisit: Number(salon?.pointPerVisit ?? 1),
    freeCustomerLimit: Number(salon?.freeCustomerLimit ?? 50),
  };
});

export const updateSalonProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = requireString(request.data?.name, "name");
  const address = optionalString(request.data?.address);
  const phone = optionalString(request.data?.phone);
  const pointPerVisit = requirePositiveNumber(request.data?.pointPerVisit, "pointPerVisit");
  const salonRef = db.collection("salons").doc(salonId);
  const salonSnap = await salonRef.get();

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  await salonRef.set({
    name,
    address: address ?? null,
    phone: phone ?? null,
    pointPerVisit,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  return {
    id: salonId,
    name,
    address: address ?? "",
    phone: phone ?? "",
    pointPerVisit,
    freeCustomerLimit: Number(salonSnap.data()?.freeCustomerLimit ?? 50),
  };
});

export const listStaffProfiles = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const snap = await db.collection("users")
    .where("salonId", "==", salonId)
    .where("role", "==", "staff")
    .limit(100)
    .get();

  return {
    staff: snap.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        salonId,
        name: data.name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        role: "staff",
        isActive: Boolean(data.isActive),
        canRedeemRewards: Boolean(data.canRedeemRewards),
      };
    }),
  };
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
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const zaloUserId = zaloProfile.zaloUserId;
  const name = optionalString(request.data?.name) ?? zaloProfile.name ?? "Khách hàng";
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
  const activeSessionRef = activeSessionRefFor(salonId, customerId);
  const now = Timestamp.now();
  let returnedSessionId = sessionRef.id;
  let returnedMirrorId = mirrorId;
  let returnedQrToken = qrToken;
  let returnedStatus = "waiting";

  await db.runTransaction(async (tx) => {
    const [customerSnap, activeSessionSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(activeSessionRef),
    ]);
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

    const activeSession = activeSessionSnap.exists ? activeSessionSnap.data() : null;
    const activeStatus = String(activeSession?.status ?? "");
    const canReuseActiveSession =
      activeSession &&
      (activeStatus === "waiting" || activeStatus === "serving") &&
      isFreshServiceSession(activeSession.createdAt, now) &&
      typeof activeSession.sessionId === "string" &&
      activeSession.sessionId.length > 0;

    if (canReuseActiveSession) {
      returnedSessionId = String(activeSession.sessionId);
      returnedMirrorId = String(activeSession.mirrorId || mirrorId);
      returnedQrToken = String(activeSession.qrToken || qrToken);
      returnedStatus = activeStatus;
      tx.set(activeSessionRef, { updatedAt: now }, { merge: true });
      return;
    }

    tx.set(sessionRef, {
      salonId,
      mirrorId,
      qrToken,
      customerId,
      zaloUserId,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    });
    tx.set(activeSessionRef, {
      salonId,
      customerId,
      sessionId: sessionRef.id,
      mirrorId,
      qrToken,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
    });
  });

  const customerSnap = await customerRef.get();
  return {
    customerId,
    sessionId: returnedSessionId,
    mirrorId: returnedMirrorId,
    qrToken: returnedQrToken,
    sessionStatus: returnedStatus,
    points: customerSnap.data()?.points ?? 0,
    zaloUserId,
  };
});

export const submitPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const note = optionalString(request.data?.note) ?? "";
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const staffName = user.name || "Nhân viên";
  const pointsRequested = 1;
  const photoUrls = Array.isArray(request.data?.photoUrls)
    ? request.data.photoUrls.filter((url: unknown) => typeof url === "string")
    : [];
  const now = Timestamp.now();
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const requestRef = db.collection("point_requests").doc(sessionId);

  await db.runTransaction(async (tx) => {
    const [sessionSnap, existingRequestSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(requestRef),
    ]);

    if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
    }

    const session = sessionSnap.data();
    if (session?.status !== "waiting") {
      throw new HttpsError("failed-precondition", "Phiên này đã được gửi yêu cầu điểm hoặc đã xử lý");
    }
    if (!isFreshServiceSession(session.createdAt, now)) {
      throw new HttpsError("failed-precondition", "Phiên cắt đã quá thời gian cho phép cộng điểm");
    }
    if (existingRequestSnap.exists) {
      throw new HttpsError("already-exists", "Phiên này đã có yêu cầu cộng điểm");
    }

    const customerRef = db.collection("customers").doc(String(session.customerId || ""));
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
      throw new HttpsError("failed-precondition", "Hồ sơ khách không thuộc salon này");
    }

    tx.set(requestRef, {
      salonId,
      sessionId,
      customerId: session.customerId,
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

    tx.set(sessionRef, {
      status: "serving",
      updatedAt: now,
    }, { merge: true });
    tx.set(activeSessionRefFor(salonId, String(session.customerId || "")), {
      salonId,
      customerId: session.customerId,
      sessionId,
      mirrorId: session.mirrorId ?? null,
      qrToken: session.qrToken ?? null,
      status: "serving",
      createdAt: session.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
  });

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
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));
  });

  return { ok: true };
});

export const rejectPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  const reason = optionalString(request.data?.reason) ?? "";
  await assertSalonRole(uid, salonId, ["owner"]);

  const requestRef = db.collection("point_requests").doc(requestId);
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
    }

    const pointRequest = snap.data();
    if (pointRequest?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Yêu cầu đã được xử lý");
    }

    tx.set(requestRef, {
      status: "rejected",
      rejectedBy: uid,
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now,
    }, { merge: true });
    tx.set(db.collection("chair_sessions").doc(String(pointRequest.sessionId || "")), {
      status: "cancelled",
      updatedAt: now,
    }, { merge: true });
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));
  });

  return { ok: true };
});

export const getOwnerOverview = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const startOfToday = Timestamp.fromMillis(startOfTodayBangkokMs());
  const nowMs = Date.now();
  const start7Days = Timestamp.fromMillis(nowMs - 7 * 24 * 60 * 60 * 1000);
  const start30Days = Timestamp.fromMillis(nowMs - 30 * 24 * 60 * 60 * 1000);
  const inactiveCutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const [
    customersTodaySnap,
    customers7DaysSnap,
    customers30DaysSnap,
    pendingRequestsSnap,
    approvedPointsSnap,
    spinsTodaySnap,
    unusedRewardsSnap,
    customersSnap,
  ] = await Promise.all([
    db.collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", startOfToday)
      .count()
      .get(),
    db.collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", start7Days)
      .count()
      .get(),
    db.collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", start30Days)
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
    db.collection("customers")
      .where("salonId", "==", salonId)
      .limit(100)
      .get(),
  ]);

  const inactiveCustomers = customersSnap.docs
    .map((doc) => {
      const customer = doc.data();
      const lastVisitAtMs = timestampMillis(customer.lastVisitAt);
      const daysSinceLastVisit = lastVisitAtMs
        ? Math.max(0, Math.floor((nowMs - lastVisitAtMs) / (24 * 60 * 60 * 1000)))
        : 999;

      return {
        id: doc.id,
        name: String(customer.name ?? "Khách hàng"),
        phoneLast4: String(customer.phoneLast4 ?? ""),
        points: Number(customer.points ?? 0),
        lastVisitAtMs,
        daysSinceLastVisit,
      };
    })
    .filter((customer) => !customer.lastVisitAtMs || customer.lastVisitAtMs < inactiveCutoffMs)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
    .slice(0, 5);

  return {
    customersToday: customersTodaySnap.data().count,
    customers7Days: customers7DaysSnap.data().count,
    customers30Days: customers30DaysSnap.data().count,
    pendingRequests: pendingRequestsSnap.data().count,
    pointsApprovedToday: Number(approvedPointsSnap.data().total ?? 0),
    spinsToday: spinsTodaySnap.data().count,
    unusedRewards: unusedRewardsSnap.data().count,
    inactiveCustomers,
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
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);

  return spinWheelForCustomer(salonId, customerId);
});

export const getCustomerHistoryFromZalo = onCall(functionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);
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
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);
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

export const searchSalonCustomers = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const term = optionalString(request.data?.term) ?? "";
  await assertSalonRole(uid, salonId, ["owner", "staff"]);

  const normalizedTerm = term.toLowerCase();
  const customersSnap = await db.collection("customers")
    .where("salonId", "==", salonId)
    .limit(120)
    .get();

  const customers = customersSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: String(data.name ?? ""),
        phoneLast4: String(data.phoneLast4 ?? ""),
        points: Number(data.points ?? 0),
        allowPhoto: Boolean(data.allowPhoto),
        lastVisitAtMs: timestampMillis(data.lastVisitAt),
      };
    })
    .filter((customer) => {
      if (!normalizedTerm) {
        return true;
      }

      return customer.name.toLowerCase().includes(normalizedTerm) ||
        customer.phoneLast4.includes(normalizedTerm);
    })
    .slice(0, 20);

  const enriched = await Promise.all(customers.map(async (customer) => {
    const [recordsSnap, rewardsSnap] = await Promise.all([
      db.collection("haircut_records")
        .where("salonId", "==", salonId)
        .where("customerId", "==", customer.id)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
      db.collection("reward_history")
        .where("salonId", "==", salonId)
        .where("customerId", "==", customer.id)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get(),
    ]);

    return {
      ...customer,
      recentRecords: recordsSnap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          staffName: data.staffName ?? "",
          note: data.note ?? "",
          pointsAdded: Number(data.pointsAdded ?? 1),
          createdAtMs: timestampMillis(data.createdAt),
        };
      }),
      unusedRewards: rewardsSnap.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            rewardName: data.rewardName ?? "",
            rewardCode: data.rewardCode ?? "",
            status: data.status ?? "unused",
            createdAtMs: timestampMillis(data.createdAt),
          };
        })
        .filter((reward) => reward.status === "unused"),
    };
  }));

  return { customers: enriched };
});

export const deleteCustomerData = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const customerRef = db.collection("customers").doc(customerId);
  const customerSnap = await customerRef.get();

  if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy hồ sơ khách trong salon này");
  }

  const [
    deletedRecords,
    deletedRewards,
    deletedRequests,
    deletedSessions,
  ] = await Promise.all([
    deleteCustomerCollectionDocs("haircut_records", salonId, customerId),
    deleteCustomerCollectionDocs("reward_history", salonId, customerId),
    deleteCustomerCollectionDocs("point_requests", salonId, customerId),
    deleteCustomerCollectionDocs("chair_sessions", salonId, customerId),
  ]);

  await customerRef.delete();
  await activeSessionRefFor(salonId, customerId).delete();
  const deletedStorageFiles = await deleteStoragePrefix(
    `salons/${salonId}/customers/${customerId}/`,
  );

  return {
    customerId,
    deletedRecords,
    deletedRewards,
    deletedRequests,
    deletedSessions,
    deletedStorageFiles,
  };
});

async function deleteCustomerCollectionDocs(
  collectionName: string,
  salonId: string,
  customerId: string,
): Promise<number> {
  const snap = await db.collection(collectionName)
    .where("salonId", "==", salonId)
    .where("customerId", "==", customerId)
    .get();

  const docs = snap.docs;
  for (let start = 0; start < docs.length; start += 450) {
    const batch = db.batch();
    docs.slice(start, start + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return docs.length;
}

async function deleteStoragePrefix(prefix: string): Promise<number> {
  try {
    const [files] = await storage.bucket().getFiles({ prefix });
    const deleted = await Promise.all(files.map(async (file) => {
      try {
        await file.delete();
        return 1;
      } catch (error) {
        console.warn("Không xóa được file Storage", file.name, error);
        return 0;
      }
    }));

    return deleted.reduce<number>((total, count) => total + count, 0);
  } catch (error) {
    console.warn("Không truy cập được Storage bucket để xóa ảnh khách", error);
    return 0;
  }
}

export const lookupRewardCode = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const rewardCodeInput = requireString(request.data?.rewardCode, "rewardCode");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);

  if (user.role === "staff" && user.canRedeemRewards !== true) {
    throw new HttpsError("permission-denied", "Nhân viên chưa được phép kiểm tra mã quà");
  }

  const query = await db.collection("reward_history")
    .where("salonId", "==", salonId)
    .where("rewardCode", "==", rewardCodeInput)
    .limit(1)
    .get();

  if (query.empty) {
    return {
      found: false,
      rewardCode: rewardCodeInput,
      status: "not_found",
    };
  }

  const doc = query.docs[0];
  const reward = doc.data();
  let customerName = "";

  if (reward.customerId) {
    const customerSnap = await db.collection("customers").doc(String(reward.customerId)).get();
    customerName = String(customerSnap.data()?.name ?? "");
  }

  return {
    found: true,
    rewardId: doc.id,
    rewardCode: reward.rewardCode ?? rewardCodeInput,
    rewardName: reward.rewardName ?? "",
    status: reward.status ?? "unused",
    customerName,
    createdAtMs: timestampMillis(reward.createdAt),
    usedAtMs: timestampMillis(reward.usedAt),
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
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const rewardSnap = await tx.get(rewardRef);
    const reward = rewardSnap.data();

    if (!rewardSnap.exists || reward?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy mã quà");
    }
    if (reward.status !== "unused") {
      throw new HttpsError("failed-precondition", "Mã quà đã được xử lý");
    }

    tx.set(rewardRef, {
      status: "used",
      usedAt: now,
      usedBy: uid,
      updatedAt: now,
    }, { merge: true });

    return {
      rewardId: rewardSnap.id,
      rewardCode: reward.rewardCode ?? rewardCodeInput,
      rewardName: reward.rewardName ?? "",
      customerId: reward.customerId ?? "",
    };
  });

  let customerName = "";
  if (result.customerId) {
    const customerSnap = await db.collection("customers").doc(String(result.customerId)).get();
    customerName = String(customerSnap.data()?.name ?? "");
  }

  return {
    rewardId: result.rewardId,
    rewardCode: result.rewardCode,
    rewardName: result.rewardName,
    customerName,
  };
});
