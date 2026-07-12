import { createHash, createHmac, randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import {
  AggregateField,
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { buildNameSearchPrefixes, normalizeSearchText } from "./customerSearch";
import {
  MAX_HAIRCUT_PHOTOS,
  MAX_HAIRCUT_PHOTO_SIZE,
  isExpectedHaircutPhotoPath,
  storageObjectNameFromDownloadUrl,
} from "./customerPhotos";
import { isValidMirrorQr } from "./security";

initializeApp();

const db = getFirestore();
const storage = getStorage();
const functionOptions = { region: "asia-southeast1" };
const zaloAppSecret = defineSecret("ZALO_APP_SECRET");
const zaloFunctionOptions = {
  ...functionOptions,
  secrets: [zaloAppSecret],
  timeoutSeconds: 30,
  concurrency: 40,
  maxInstances: 30,
};
const SESSION_POINT_REQUEST_WINDOW_MS = 12 * 60 * 60 * 1000;
const ZALO_PROFILE_CACHE_TTL_MS = 60_000;
const ZALO_PROFILE_CACHE_MAX_SIZE = 500;
const PUBLIC_RATE_LIMITS = {
  registerCustomerFromZalo: { windowMs: 60_000, tokenLimit: 6, ipLimit: 60 },
  getCustomerSessionFromZalo: { windowMs: 60_000, tokenLimit: 20, ipLimit: 180 },
  getCustomerHistoryFromZalo: { windowMs: 60_000, tokenLimit: 12, ipLimit: 120 },
  getCustomerRewardsFromZalo: { windowMs: 60_000, tokenLimit: 12, ipLimit: 120 },
  spinLuckyWheelFromZalo: { windowMs: 60_000, tokenLimit: 4, ipLimit: 40 },
} as const;

type PublicEndpoint = keyof typeof PUBLIC_RATE_LIMITS;

type UserRole = "owner" | "staff";

type AppUser = {
  salonId: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  canRedeemRewards?: boolean;
  inviteStatus?: "pending" | "accepted";
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

const zaloProfileCache = new Map<string, { profile: ZaloProfile; expiresAtMs: number }>();

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpsError("invalid-argument", `Thiếu trường bắt buộc: ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.length > 2_000) {
    throw new HttpsError("invalid-argument", `${field} quá dài`);
  }
  return trimmed;
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

function limitedString(value: unknown, field: string, maxLength: number): string {
  const result = requireString(value, field);
  if (result.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} không được vượt quá ${maxLength} ký tự`);
  }
  return result;
}

function optionalLimitedString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  const result = optionalString(value);
  if (result && result.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} không được vượt quá ${maxLength} ký tự`);
  }
  return result;
}

function boundedQueryLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function safePhotoUrls(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > MAX_HAIRCUT_PHOTOS) {
    throw new HttpsError(
      "invalid-argument",
      `Chỉ được gửi tối đa ${MAX_HAIRCUT_PHOTOS} ảnh kiểu tóc`,
    );
  }

  const urls = value.map((item, index) => {
    const url = limitedString(item, `photoUrls[${index}]`, 500);
    try {
      if (new URL(url).protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new HttpsError("invalid-argument", `Ảnh ${index + 1} không có link HTTPS hợp lệ`);
    }
    return url;
  });

  if (new Set(urls).size !== urls.length) {
    throw new HttpsError("invalid-argument", "Danh sách ảnh có ảnh bị trùng");
  }

  return urls;
}

async function assertSubmittedHaircutPhotos(input: {
  photoUrls: string[];
  salonId: string;
  customerId: string;
  sessionId: string;
  uploaderUid: string;
}) {
  if (input.photoUrls.length === 0) {
    return;
  }

  const bucket = storage.bucket();
  await Promise.all(
    input.photoUrls.map(async (photoUrl, index) => {
      const objectName = storageObjectNameFromDownloadUrl(photoUrl, bucket.name);
      if (
        !objectName ||
        !isExpectedHaircutPhotoPath(objectName, {
          salonId: input.salonId,
          customerId: input.customerId,
          sessionId: input.sessionId,
        })
      ) {
        throw new HttpsError("invalid-argument", `Ảnh ${index + 1} không thuộc đúng lượt cắt này`);
      }

      let metadata;
      try {
        [metadata] = await bucket.file(objectName).getMetadata();
      } catch {
        throw new HttpsError("failed-precondition", `Không tìm thấy ảnh ${index + 1} đã tải lên`);
      }

      const customMetadata = metadata.metadata ?? {};
      const metadataIsValid =
        metadata.contentType === "image/jpeg" &&
        Number(metadata.size) > 0 &&
        Number(metadata.size) <= MAX_HAIRCUT_PHOTO_SIZE &&
        customMetadata.salonId === input.salonId &&
        customMetadata.customerId === input.customerId &&
        customMetadata.sessionId === input.sessionId &&
        customMetadata.uploaderUid === input.uploaderUid;

      if (!metadataIsValid) {
        throw new HttpsError(
          "invalid-argument",
          `Ảnh ${index + 1} không có thông tin xác thực hợp lệ`,
        );
      }
    }),
  );
}

async function deleteSubmittedHaircutPhotos(input: {
  photoUrls: unknown;
  salonId: string;
  customerId: string;
  sessionId: string;
}) {
  if (!Array.isArray(input.photoUrls)) {
    return;
  }

  const bucket = storage.bucket();
  await Promise.all(
    input.photoUrls.slice(0, MAX_HAIRCUT_PHOTOS).map(async (value, index) => {
      if (typeof value !== "string") {
        return;
      }

      const objectName = storageObjectNameFromDownloadUrl(value, bucket.name);
      if (
        !objectName ||
        !isExpectedHaircutPhotoPath(objectName, {
          salonId: input.salonId,
          customerId: input.customerId,
          sessionId: input.sessionId,
        })
      ) {
        return;
      }

      try {
        await bucket.file(objectName).delete({ ignoreNotFound: true });
      } catch {
        console.warn("Không xóa được ảnh kiểu tóc", { photoIndex: index + 1 });
      }
    }),
  );
}

function trustedStoredHaircutPhotoUrls(
  value: unknown,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const bucketName = storage.bucket().name;
  return value.slice(0, MAX_HAIRCUT_PHOTOS).filter((photoUrl): photoUrl is string => {
    if (typeof photoUrl !== "string") {
      return false;
    }

    const objectName = storageObjectNameFromDownloadUrl(photoUrl, bucketName);
    return Boolean(objectName && isExpectedHaircutPhotoPath(objectName, input));
  });
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
  if (user.role === "staff" && user.inviteStatus === "pending") {
    await snap.ref.set(
      {
        inviteStatus: "accepted",
        inviteAcceptedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    user.inviteStatus = "accepted";
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
  return createHash("sha256").update(`${salonId}:${zaloUserId}`).digest("hex").slice(0, 40);
}

function activeSessionRefFor(salonId: string, customerId: string) {
  const id = createHash("sha256").update(`${salonId}:${customerId}`).digest("hex").slice(0, 40);
  return db.collection("active_service_sessions").doc(id);
}

async function enforcePublicRequestPolicy(
  endpoint: PublicEndpoint,
  request: {
    app?: unknown;
    rawRequest: { ip?: string; get(name: string): string | undefined };
  },
  salonId: string,
  accessTokenInput: unknown,
) {
  if (process.env.REQUIRE_ZALO_APP_CHECK === "true" && !request.app) {
    throw new HttpsError("failed-precondition", "Thiết bị chưa vượt qua kiểm tra bảo mật");
  }

  const accessToken = requireString(accessTokenInput, "zaloAccessToken");
  const forwardedIp = request.rawRequest.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwardedIp || request.rawRequest.ip || "unknown";
  const policy = PUBLIC_RATE_LIMITS[endpoint];
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / policy.windowMs) * policy.windowMs;
  const expiresAt = Timestamp.fromMillis(windowStart + policy.windowMs * 2);
  const scopes = [
    {
      kind: "token",
      value: createHash("sha256").update(accessToken).digest("hex"),
      limit: policy.tokenLimit,
    },
    {
      kind: "ip",
      value: createHash("sha256").update(clientIp).digest("hex"),
      limit: policy.ipLimit,
    },
  ];
  const refs = scopes.map((scope) => {
    const id = createHash("sha256")
      .update(`${endpoint}:${scope.kind}:${scope.value}:${windowStart}`)
      .digest("hex");
    return db.collection("_public_rate_limits").doc(id);
  });

  await db.runTransaction(async (tx) => {
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

    snapshots.forEach((snapshot, index) => {
      if (Number(snapshot.data()?.count ?? 0) >= scopes[index].limit) {
        throw new HttpsError(
          "resource-exhausted",
          "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.",
        );
      }
    });

    refs.forEach((ref, index) => {
      tx.set(
        ref,
        {
          endpoint,
          salonIdHash: createHash("sha256").update(salonId).digest("hex"),
          scope: scopes[index].kind,
          count: FieldValue.increment(1),
          windowStart: Timestamp.fromMillis(windowStart),
          expiresAt,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    });
  });
}

async function verifyZaloAccessToken(accessTokenInput: unknown): Promise<ZaloProfile> {
  const accessToken = requireString(accessTokenInput, "zaloAccessToken");
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
  const cachedProfile = zaloProfileCache.get(accessTokenHash);
  if (cachedProfile && cachedProfile.expiresAtMs > Date.now()) {
    return cachedProfile.profile;
  }
  if (cachedProfile) {
    zaloProfileCache.delete(accessTokenHash);
  }
  const appSecret =
    zaloAppSecret.value() || process.env.ZALO_APP_SECRET || process.env.ZALO_SECRET_KEY || "";

  if (!appSecret || appSecret.includes("your-")) {
    throw new HttpsError(
      "failed-precondition",
      "Thiếu ZALO_APP_SECRET để xác minh danh tính Zalo ở server",
    );
  }

  const appsecretProof = createHmac("sha256", appSecret).update(accessToken).digest("hex");
  const endpoint = new URL(process.env.ZALO_PROFILE_ENDPOINT || "https://graph.zalo.me/v2.0/me");
  endpoint.searchParams.set("fields", "id,name,picture");

  let payload: Record<string, unknown>;
  let responseStatus: number | "network-error" = "network-error";
  let responseErrorCode: string | number = "request-failed";
  const safeLogMessage = (value: unknown) => {
    let message = String(value || "Không xác minh được Zalo access token");
    for (const sensitiveValue of [accessToken, appSecret, appsecretProof]) {
      message = message.split(sensitiveValue).join("[redacted]");
    }
    return message.slice(0, 500);
  };
  const logVerificationFailure = (errorCode: string | number, message: string) => {
    console.warn("Không xác minh được danh tính Zalo", {
      status: responseStatus,
      errorCode,
      message: safeLogMessage(message),
    });
  };

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        access_token: accessToken,
        appsecret_proof: appsecretProof,
      },
    });
    responseStatus = response.status;

    payload = (await response.json()) as Record<string, unknown>;
    responseErrorCode = String(payload.error ?? payload.error_code ?? `http-${response.status}`);
    if (!response.ok) {
      throw new Error(String(payload.message ?? response.statusText));
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không xác minh được Zalo access token";
    logVerificationFailure(responseErrorCode, message);
    throw new HttpsError("unauthenticated", message);
  }

  const errorCode = Number(payload.error ?? 0);
  if (Number.isFinite(errorCode) && errorCode !== 0) {
    const message = String(payload.message ?? "Zalo access token không hợp lệ");
    logVerificationFailure(errorCode, message);
    throw new HttpsError("unauthenticated", message);
  }

  const zaloUserId = String(payload.id ?? "").trim();
  if (!zaloUserId) {
    const message = "Zalo không trả về user id hợp lệ";
    logVerificationFailure("missing-user-id", message);
    throw new HttpsError("unauthenticated", message);
  }

  const picture = payload.picture as { data?: { url?: unknown } } | undefined;

  const profile = {
    zaloUserId,
    name: optionalString(payload.name),
    avatar: optionalString(picture?.data?.url),
  };
  if (zaloProfileCache.size >= ZALO_PROFILE_CACHE_MAX_SIZE) {
    const oldestKey = zaloProfileCache.keys().next().value;
    if (oldestKey) {
      zaloProfileCache.delete(oldestKey);
    }
  }
  zaloProfileCache.set(accessTokenHash, {
    profile,
    expiresAtMs: Date.now() + ZALO_PROFILE_CACHE_TTL_MS,
  });

  return profile;
}

function last4(phone?: string): string | undefined {
  if (!phone) {
    return undefined;
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

async function ensureCustomerSearchFields(salonId: string): Promise<void> {
  const markerId = createHash("sha256").update(`name-prefixes-v1:${salonId}`).digest("hex");
  const markerRef = db.collection("_customer_search_migrations").doc(markerId);
  const markerSnap = await markerRef.get();
  if (markerSnap.data()?.complete === true) {
    return;
  }

  let customersQuery = db
    .collection("customers")
    .where("salonId", "==", salonId)
    .orderBy(FieldPath.documentId())
    .limit(400);
  const cursorId = String(markerSnap.data()?.cursorId || "");
  if (cursorId) {
    const cursorSnap = await db.collection("customers").doc(cursorId).get();
    if (cursorSnap.exists && cursorSnap.data()?.salonId === salonId) {
      customersQuery = customersQuery.startAfter(cursorSnap);
    }
  }

  const customersSnap = await customersQuery.get();
  const batch = db.batch();
  customersSnap.docs.forEach((customerDoc) => {
    const customer = customerDoc.data();
    const expectedNameSearch = normalizeSearchText(String(customer.name || ""));
    const expectedNamePrefixes = buildNameSearchPrefixes(String(customer.name || ""));
    if (
      customer.nameSearch !== expectedNameSearch ||
      JSON.stringify(customer.namePrefixes ?? []) !== JSON.stringify(expectedNamePrefixes)
    ) {
      batch.set(
        customerDoc.ref,
        { nameSearch: expectedNameSearch, namePrefixes: expectedNamePrefixes },
        { merge: true },
      );
    }
  });
  batch.set(
    markerRef,
    {
      salonIdHash: markerId,
      cursorId: customersSnap.docs[customersSnap.docs.length - 1]?.id ?? null,
      complete: customersSnap.size < 400,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
  await batch.commit();
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
  return (
    createdAtMs <= nowMs + 5 * 60 * 1000 && nowMs - createdAtMs <= SESSION_POINT_REQUEST_WINDOW_MS
  );
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

async function spinWheelForCustomer(salonId: string, customerId: string): Promise<SpinWheelResult> {
  const wheelRef = db.collection("lucky_wheel").doc(salonId);
  const customerRef = db.collection("customers").doc(customerId);
  const rewardRef = db.collection("reward_history").doc();
  const now = Timestamp.now();

  let selectedReward = "";
  let selectedCode = "";
  let selectedIndex = 0;
  let pointsAfter = 0;

  await db.runTransaction(async (tx) => {
    const [wheelSnap, customerSnap] = await Promise.all([tx.get(wheelRef), tx.get(customerRef)]);
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

    const activeSlots = (wheel?.slots ?? []).filter(
      (slot: LuckyWheelSlot) => slot.active && slot.label.trim().length > 0,
    );
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
    const existingUser = await tx.get(userRef);
    const existingUserData = existingUser.exists ? existingUser.data() : null;
    const existingSalonId =
      typeof existingUserData?.salonId === "string" ? existingUserData.salonId.trim() : "";

    if (existingSalonId) {
      throw new HttpsError("failed-precondition", "Tài khoản này đã thuộc một salon");
    }
    if (existingUserData?.role && existingUserData.role !== "owner") {
      throw new HttpsError("permission-denied", "Tài khoản này không thể tạo salon");
    }

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
    tx.set(
      userRef,
      {
        salonId: salonRef.id,
        name: ownerName,
        phone: phone ?? null,
        role: "owner",
        isActive: true,
        canRedeemRewards: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
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

  const email = limitedString(request.data?.email, "email", 254).toLowerCase();
  const name = limitedString(request.data?.name, "name", 80);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const canRedeemRewards = Boolean(request.data?.canRedeemRewards);
  const now = Timestamp.now();
  let staffUid = "";

  try {
    const userRecord = await getAuth().createUser({
      email,
      displayName: name,
      disabled: false,
      emailVerified: false,
    });
    staffUid = userRecord.uid;

    await db
      .collection("users")
      .doc(staffUid)
      .set({
        salonId,
        name,
        email,
        phone: phone ?? null,
        role: "staff",
        isActive: true,
        canRedeemRewards,
        inviteStatus: "pending",
        invitedBy: uid,
        invitedAt: now,
        createdAt: now,
        updatedAt: now,
      });

    return { uid: staffUid, email };
  } catch (error) {
    if (staffUid) {
      await getAuth()
        .deleteUser(staffUid)
        .catch(() => undefined);
    }
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Email này đã có tài khoản");
    }
    if (code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Email nhân viên không hợp lệ");
    }
    throw new HttpsError("internal", "Không tạo được lời mời nhân viên");
  }
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
  const isActive = typeof request.data?.isActive === "boolean" ? request.data.isActive : undefined;
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
  const isActive = typeof request.data?.isActive === "boolean" ? request.data.isActive : undefined;
  const canRedeemRewards =
    typeof request.data?.canRedeemRewards === "boolean" ? request.data.canRedeemRewards : undefined;
  const staffRef = db.collection("users").doc(staffUid);
  const staffSnap = await staffRef.get();

  if (
    !staffSnap.exists ||
    staffSnap.data()?.salonId !== salonId ||
    staffSnap.data()?.role !== "staff"
  ) {
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

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        avatarUrl: avatarUrl || null,
        updatedAt: now,
      },
      { merge: true },
    );

  await getAuth().updateUser(uid, {
    photoURL: avatarUrl || null,
  });

  return { avatarUrl };
});

export const getSalonProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner", "staff"]);

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

  await salonRef.set(
    {
      name,
      address: address ?? null,
      phone: phone ?? null,
      pointPerVisit,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

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

  const snap = await db
    .collection("users")
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
        inviteStatus: data.inviteStatus ?? "accepted",
      };
    }),
  };
});

export const createManualCustomer = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = limitedString(request.data?.name, "name", 80);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const birthday = optionalLimitedString(request.data?.birthday, "birthday", 20);
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
      nameSearch: normalizeSearchText(name),
      namePrefixes: buildNameSearchPrefixes(name),
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

export const registerCustomerFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const mirrorId = requireString(request.data?.mirrorId, "mirrorId");
  const qrToken = requireString(request.data?.qrToken, "qrToken");
  await enforcePublicRequestPolicy(
    "registerCustomerFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const zaloUserId = zaloProfile.zaloUserId;
  const name =
    optionalLimitedString(request.data?.name, "name", 80) ??
    String(zaloProfile.name ?? "Khách hàng").slice(0, 80);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const birthday = optionalLimitedString(request.data?.birthday, "birthday", 20);
  const allowPhoto = requireBoolean(request.data?.allowPhoto, "allowPhoto");

  const mirrorSnap = await db.collection("mirrors").doc(mirrorId).get();
  if (!mirrorSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy QR gương");
  }
  const mirror = mirrorSnap.data();
  if (!isValidMirrorQr(mirror, salonId, qrToken)) {
    throw new HttpsError("permission-denied", "QR gương không hợp lệ");
  }

  const customerId = customerIdFor(salonId, zaloUserId);
  const customerRef = db.collection("customers").doc(customerId);
  const sessionRef = db.collection("chair_sessions").doc();
  const activeSessionRef = activeSessionRefFor(salonId, customerId);
  const now = Timestamp.now();
  const mirrorName = String(mirror?.name || "Gương").slice(0, 80);
  let returnedSessionId = sessionRef.id;
  let returnedMirrorId = mirrorId;
  let returnedMirrorName = mirrorName;
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
      nameSearch: normalizeSearchText(name),
      namePrefixes: buildNameSearchPrefixes(name),
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
      (activeStatus === "waiting" ||
        activeStatus === "serving" ||
        activeStatus === "pending_approval") &&
      isFreshServiceSession(activeSession.createdAt, now) &&
      typeof activeSession.sessionId === "string" &&
      activeSession.sessionId.length > 0;

    if (canReuseActiveSession) {
      returnedSessionId = String(activeSession.sessionId);
      returnedMirrorId = String(activeSession.mirrorId || mirrorId);
      returnedMirrorName = String(activeSession.mirrorName || "");
      returnedQrToken = String(activeSession.qrToken || qrToken);
      returnedStatus =
        activeStatus === "serving" && !activeSession.assignedStaffId
          ? "pending_approval"
          : activeStatus;
      tx.set(activeSessionRef, { updatedAt: now }, { merge: true });
      return;
    }

    tx.set(sessionRef, {
      salonId,
      mirrorId,
      mirrorName,
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
      mirrorName,
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
    mirrorName: returnedMirrorName,
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
  const note = optionalLimitedString(request.data?.note, "note", 500) ?? "";
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const staffName = user.name || "Nhân viên";
  const salonSnap = await db.collection("salons").doc(salonId).get();
  const pointsRequested = Math.max(1, Math.floor(Number(salonSnap.data()?.pointPerVisit ?? 1)));
  const photoUrls = safePhotoUrls(request.data?.photoUrls);
  const now = Timestamp.now();
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const requestRef = db.collection("point_requests").doc(sessionId);

  if (photoUrls.length > 0) {
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data();
    if (!sessionSnap.exists || session?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
    }
    if (session.status !== "serving" || session.assignedStaffId !== uid) {
      throw new HttpsError("permission-denied", "Bạn không phụ trách lượt cắt này");
    }

    const customerId = String(session.customerId || "");
    const customerSnap = await db.collection("customers").doc(customerId).get();
    if (
      !customerSnap.exists ||
      customerSnap.data()?.salonId !== salonId ||
      customerSnap.data()?.allowPhoto !== true
    ) {
      throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
    }

    await assertSubmittedHaircutPhotos({
      photoUrls,
      salonId,
      customerId,
      sessionId,
      uploaderUid: uid,
    });
  }

  await db.runTransaction(async (tx) => {
    const [sessionSnap, existingRequestSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(requestRef),
    ]);

    if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
    }

    const session = sessionSnap.data();
    if (session?.status !== "serving") {
      throw new HttpsError(
        "failed-precondition",
        session?.status === "waiting"
          ? "Nhân viên cần nhận khách trước khi gửi yêu cầu điểm"
          : "Phiên này đã được gửi yêu cầu điểm hoặc đã xử lý",
      );
    }
    if (session.assignedStaffId !== uid) {
      throw new HttpsError(
        "permission-denied",
        `Lượt này đang do ${String(session.assignedStaffName || "nhân viên khác")} phụ trách`,
      );
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
    if (photoUrls.length > 0 && customerSnap.data()?.allowPhoto !== true) {
      throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
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

    tx.set(
      sessionRef,
      {
        status: "pending_approval",
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      activeSessionRefFor(salonId, String(session.customerId || "")),
      {
        salonId,
        customerId: session.customerId,
        sessionId,
        mirrorId: session.mirrorId ?? null,
        mirrorName: session.mirrorName ?? null,
        qrToken: session.qrToken ?? null,
        status: "pending_approval",
        assignedStaffId: uid,
        assignedStaffName: staffName,
        createdAt: session.createdAt ?? now,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  return { requestId: requestRef.id };
});

export const claimServiceSession = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const requestRef = db.collection("point_requests").doc(sessionId);
  const now = Timestamp.now();
  let resultStatus = "serving";
  let assignedStaffId = uid;
  let assignedStaffName = user.name || "Nhân viên";

  await db.runTransaction(async (tx) => {
    const [sessionSnap, pointRequestSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(requestRef),
    ]);

    if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy lượt phục vụ");
    }

    const session = sessionSnap.data() ?? {};
    if (!isFreshServiceSession(session.createdAt, now)) {
      throw new HttpsError("failed-precondition", "Lượt phục vụ đã quá thời gian cho phép");
    }

    if (
      session.status === "serving" &&
      !session.assignedStaffId &&
      pointRequestSnap.data()?.status === "pending"
    ) {
      resultStatus = "pending_approval";
      assignedStaffId = String(pointRequestSnap.data()?.staffId || "");
      assignedStaffName = String(pointRequestSnap.data()?.staffName || "Nhân viên");
      tx.set(
        sessionRef,
        {
          status: "pending_approval",
          assignedStaffId: assignedStaffId || null,
          assignedStaffName,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    if (session.status === "serving") {
      if (session.assignedStaffId !== uid) {
        throw new HttpsError(
          "failed-precondition",
          `Khách đã được ${String(session.assignedStaffName || "nhân viên khác")} nhận`,
        );
      }
      assignedStaffName = String(session.assignedStaffName || assignedStaffName);
      return;
    }

    if (session.status !== "waiting") {
      throw new HttpsError("failed-precondition", "Lượt này không còn ở trạng thái chờ nhận");
    }

    const assignment = {
      status: "serving",
      assignedStaffId: uid,
      assignedStaffName,
      claimedAt: now,
      updatedAt: now,
    };
    tx.set(sessionRef, assignment, { merge: true });
    tx.set(
      activeSessionRefFor(salonId, String(session.customerId || "")),
      {
        salonId,
        customerId: session.customerId,
        sessionId,
        mirrorId: session.mirrorId ?? null,
        mirrorName: session.mirrorName ?? null,
        qrToken: session.qrToken ?? null,
        ...assignment,
        createdAt: session.createdAt ?? now,
      },
      { merge: true },
    );
  });

  return { status: resultStatus, assignedStaffId, assignedStaffName };
});

export const approvePointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const requestRef = db.collection("point_requests").doc(requestId);
  const now = Timestamp.now();

  const discardedPhotos = await db.runTransaction(async (tx) => {
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
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
      throw new HttpsError("failed-precondition", "Hồ sơ khách không thuộc salon này");
    }
    const recordRef = db.collection("haircut_records").doc();
    const sessionRef = db.collection("chair_sessions").doc(pointRequest.sessionId);
    const pointsAdded = Number(pointRequest.pointsRequested ?? pointRequest.pointsAdded ?? 1);
    const canKeepPhotos = customerSnap.data()?.allowPhoto === true;
    const recordPhotoUrls = canKeepPhotos
      ? trustedStoredHaircutPhotoUrls(pointRequest.photoUrls, {
          salonId,
          customerId: String(pointRequest.customerId || ""),
          sessionId: String(pointRequest.sessionId || ""),
        })
      : [];

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
      photoUrls: recordPhotoUrls,
      updatedAt: now,
    });
    tx.set(recordRef, {
      salonId,
      customerId: pointRequest.customerId,
      staffId: pointRequest.staffId,
      staffName: pointRequest.staffName ?? "",
      pointRequestId: requestId,
      note: pointRequest.note ?? "",
      photoUrls: recordPhotoUrls,
      pointsAdded,
      approvedBy: uid,
      createdAt: now,
    });
    tx.set(
      sessionRef,
      {
        status: "completed",
        updatedAt: now,
      },
      { merge: true },
    );
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));

    return canKeepPhotos
      ? null
      : {
          photoUrls: pointRequest.photoUrls,
          customerId: String(pointRequest.customerId || ""),
          sessionId: String(pointRequest.sessionId || ""),
        };
  });

  if (discardedPhotos) {
    await deleteSubmittedHaircutPhotos({
      ...discardedPhotos,
      salonId,
    });
  }

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

  const rejectedPhotos = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
    }

    const pointRequest = snap.data();
    if (pointRequest?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Yêu cầu đã được xử lý");
    }

    tx.set(
      requestRef,
      {
        status: "rejected",
        rejectedBy: uid,
        rejectedAt: now,
        rejectionReason: reason,
        photoUrls: [],
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("chair_sessions").doc(String(pointRequest.sessionId || "")),
      {
        status: "cancelled",
        updatedAt: now,
      },
      { merge: true },
    );
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));

    return {
      photoUrls: pointRequest.photoUrls,
      customerId: String(pointRequest.customerId || ""),
      sessionId: String(pointRequest.sessionId || ""),
    };
  });

  await deleteSubmittedHaircutPhotos({
    ...rejectedPhotos,
    salonId,
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
    approvedPointsTodaySnap,
    spinsTodaySnap,
    unusedRewardsSnap,
    customersSnap,
  ] = await Promise.all([
    db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", startOfToday)
      .count()
      .get(),
    db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", start7Days)
      .count()
      .get(),
    db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", start30Days)
      .count()
      .get(),
    db
      .collection("point_requests")
      .where("salonId", "==", salonId)
      .where("status", "==", "pending")
      .count()
      .get(),
    db
      .collection("point_requests")
      .where("salonId", "==", salonId)
      .where("status", "==", "approved")
      .where("approvedAt", ">=", startOfToday)
      .aggregate({ points: AggregateField.sum("pointsAdded") })
      .get(),
    db
      .collection("reward_history")
      .where("salonId", "==", salonId)
      .where("createdAt", ">=", startOfToday)
      .count()
      .get(),
    db
      .collection("reward_history")
      .where("salonId", "==", salonId)
      .where("status", "==", "unused")
      .count()
      .get(),
    db
      .collection("customers")
      .where("salonId", "==", salonId)
      .where("lastVisitAt", "<", Timestamp.fromMillis(inactiveCutoffMs))
      .orderBy("lastVisitAt", "asc")
      .limit(5)
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
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  return {
    customersToday: customersTodaySnap.data().count,
    customers7Days: customers7DaysSnap.data().count,
    customers30Days: customers30DaysSnap.data().count,
    pendingRequests: pendingRequestsSnap.data().count,
    pointsApprovedToday: Number(approvedPointsTodaySnap.data().points ?? 0),
    spinsToday: spinsTodaySnap.data().count,
    unusedRewards: unusedRewardsSnap.data().count,
    inactiveCustomers,
  };
});

export const updateLuckyWheel = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const requiredPoints = requirePositiveNumber(request.data?.requiredPoints, "requiredPoints");
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

  await db.collection("lucky_wheel").doc(salonId).set(
    {
      salonId,
      requiredPoints,
      deductPointsAfterSpin,
      slots: cleanedSlots,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return { ok: true };
});

export const spinLuckyWheel = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  await assertSalonRole(uid, salonId, ["owner"]);

  return spinWheelForCustomer(salonId, customerId);
});

export const spinLuckyWheelFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  await enforcePublicRequestPolicy(
    "spinLuckyWheelFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);

  return spinWheelForCustomer(salonId, customerId);
});

export const getCustomerSessionFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  await enforcePublicRequestPolicy(
    "getCustomerSessionFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);

  const [customerSnap, sessionSnap, wheelSnap] = await Promise.all([
    db.collection("customers").doc(customerId).get(),
    db.collection("chair_sessions").doc(sessionId).get(),
    db.collection("lucky_wheel").doc(salonId).get(),
  ]);

  if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy hồ sơ khách hàng");
  }
  if (
    !sessionSnap.exists ||
    sessionSnap.data()?.salonId !== salonId ||
    sessionSnap.data()?.customerId !== customerId
  ) {
    throw new HttpsError("permission-denied", "Lượt cắt không thuộc khách hàng này");
  }

  const customer = customerSnap.data() ?? {};
  const session = sessionSnap.data() ?? {};
  const wheel = wheelSnap.data() ?? {};
  const slots = Array.isArray(wheel.slots)
    ? wheel.slots.slice(0, 6).map((slot: unknown) => {
        const value =
          typeof slot === "object" && slot !== null
            ? (slot as { label?: unknown; active?: unknown })
            : {};
        return {
          label: typeof value.label === "string" ? value.label.trim() : "",
          active: value.active !== false,
        };
      })
    : [];

  return {
    sessionStatus:
      session.status === "serving" && !session.assignedStaffId
        ? "pending_approval"
        : ["waiting", "serving", "pending_approval", "completed", "cancelled"].includes(
              String(session.status),
            )
          ? String(session.status)
          : "waiting",
    assignedStaffName: String(session.assignedStaffName ?? ""),
    claimedAtMs: timestampMillis(session.claimedAt),
    mirrorName: String(session.mirrorName ?? ""),
    customer: {
      customerId,
      name: String(customer.name ?? zaloProfile.name ?? "Khách hàng"),
      phoneLast4: String(customer.phoneLast4 ?? ""),
      points: Math.max(0, Number(customer.points ?? 0)),
      allowPhoto: Boolean(customer.allowPhoto),
    },
    wheelConfig: {
      requiredPoints: Math.max(1, Math.floor(Number(wheel.requiredPoints ?? 5))),
      deductPointsAfterSpin: wheel.deductPointsAfterSpin !== false,
      slots,
    },
  };
});

export const getCustomerHistoryFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  await enforcePublicRequestPolicy(
    "getCustomerHistoryFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);
  const limit = boundedQueryLimit(request.data?.limit, 20, 50);

  const [recordsSnap, customerSnap] = await Promise.all([
    db
      .collection("haircut_records")
      .where("salonId", "==", salonId)
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get(),
    db.collection("customers").doc(customerId).get(),
  ]);
  const canViewPhotos =
    customerSnap.exists &&
    customerSnap.data()?.salonId === salonId &&
    customerSnap.data()?.allowPhoto === true;

  const staffIds = [
    ...new Set(
      recordsSnap.docs
        .map((doc) => doc.data().staffId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const staffDocs =
    staffIds.length > 0
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
        photoUrls: canViewPhotos
          ? trustedStoredHaircutPhotoUrls(data.photoUrls, {
              salonId,
              customerId,
              sessionId: String(data.pointRequestId || ""),
            })
          : [],
        pointsAdded: data.pointsAdded ?? 0,
      };
    }),
  };
});

export const getCustomerRewardsFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  await enforcePublicRequestPolicy(
    "getCustomerRewardsFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);
  const limit = boundedQueryLimit(request.data?.limit, 20, 50);

  const rewardsSnap = await db
    .collection("reward_history")
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
  const term = optionalLimitedString(request.data?.term, "term", 80) ?? "";
  const cursor = optionalString(request.data?.cursor);
  const requestedPageSize = Number(request.data?.pageSize ?? 10);
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(Math.max(Math.floor(requestedPageSize), 5), 20)
    : 10;
  await assertSalonRole(uid, salonId, ["owner", "staff"]);

  const normalizedTerm = normalizeSearchText(term);
  if (normalizedTerm.length < 2) {
    throw new HttpsError("invalid-argument", "Nhập ít nhất 2 ký tự để tìm khách");
  }

  const phoneDigits = term.replace(/\D/g, "");
  const isPhoneSearch = phoneDigits.length === term.replace(/\s/g, "").length;
  if (isPhoneSearch && phoneDigits.length !== 4) {
    throw new HttpsError("invalid-argument", "Vui lòng nhập đủ 4 số cuối điện thoại");
  }

  if (!isPhoneSearch) {
    await ensureCustomerSearchFields(salonId);
  }

  let customersQuery = isPhoneSearch
    ? db
        .collection("customers")
        .where("salonId", "==", salonId)
        .where("phoneLast4", "==", phoneDigits)
        .orderBy(FieldPath.documentId())
    : db
        .collection("customers")
        .where("salonId", "==", salonId)
        .where("namePrefixes", "array-contains", normalizedTerm)
        .orderBy(FieldPath.documentId());

  if (cursor) {
    const cursorSnap = await db.collection("customers").doc(cursor).get();
    if (!cursorSnap.exists || cursorSnap.data()?.salonId !== salonId) {
      throw new HttpsError("invalid-argument", "Trang dữ liệu không còn hợp lệ");
    }
    customersQuery = customersQuery.startAfter(cursorSnap);
  }

  const customersSnap = await customersQuery.limit(pageSize + 1).get();
  const hasMore = customersSnap.docs.length > pageSize;
  const pageDocs = customersSnap.docs.slice(0, pageSize);
  const customers = pageDocs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? ""),
      phoneLast4: String(data.phoneLast4 ?? ""),
      points: Number(data.points ?? 0),
      allowPhoto: Boolean(data.allowPhoto),
      lastVisitAtMs: timestampMillis(data.lastVisitAt),
    };
  });

  const enriched = await Promise.all(
    customers.map(async (customer) => {
      const [recordsSnap, rewardsSnap] = await Promise.all([
        db
          .collection("haircut_records")
          .where("salonId", "==", salonId)
          .where("customerId", "==", customer.id)
          .orderBy("createdAt", "desc")
          .limit(5)
          .get(),
        db
          .collection("reward_history")
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
    }),
  );

  return {
    customers: enriched,
    nextCursor: hasMore ? (pageDocs.at(-1)?.id ?? null) : null,
  };
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

  const [deletedRecords, deletedRewards, deletedRequests, deletedSessions] = await Promise.all([
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
  const snap = await db
    .collection(collectionName)
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
    const deleted = await Promise.all(
      files.map(async (file) => {
        try {
          await file.delete();
          return 1;
        } catch (error) {
          console.warn("Không xóa được file Storage", file.name, error);
          return 0;
        }
      }),
    );

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

  const query = await db
    .collection("reward_history")
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

  const query = await db
    .collection("reward_history")
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

    tx.set(
      rewardRef,
      {
        status: "used",
        usedAt: now,
        usedBy: uid,
        updatedAt: now,
      },
      { merge: true },
    );

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
