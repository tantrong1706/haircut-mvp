import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import {
  ApiErrorCode,
  DeviceTokenSchema,
  SalonStatusSchema,
  SystemFeaturesSchema,
  normalizeSystemFeatures,
  type SystemFeatures,
} from "@haircut/contracts";
import { initializeApp } from "firebase-admin/app";
import {
  AggregateField,
  DocumentReference,
  DocumentData,
  FieldPath,
  FieldValue,
  QueryDocumentSnapshot,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import {
  buildCustomerContactPatch,
  canCreateCustomerWithinPlan,
  canCancelServiceSession,
  canRestoreReward,
  countUniqueCustomersSince,
  deletionJobOutcome,
  directPointAwardDecision,
  effectiveRewardStatus,
  isServiceSessionExpired,
  isVerifiedOwnerIdentity,
  legacyBranchPatch,
  normalizeWheelSlotType,
  rewardExpiresAtMs,
  activeWheelSlotCount,
  selectWheelSlotByIndex,
  serviceSessionExpiresAtMs,
  wheelRewardOutcome,
} from "./businessRules";
import { buildNameSearchPrefixes, normalizeSearchText } from "./customerSearch";
import {
  isExpectedSalonAvatarPath,
  isValidSalonAvatarMetadata,
  salonAvatarObjectPath,
} from "./domains/salons/branding";
import {
  runSalonDeletionJob,
  type SalonDeletionAdapter,
  type SalonDeletionAuditAction,
  type SalonDeletionJobPatch,
  type SalonDeletionJobState,
  type SalonDeletionStatus,
} from "./domains/salons/deletionJob";
import {
  MAX_HAIRCUT_PHOTOS,
  MAX_HAIRCUT_PHOTO_SIZE,
  isExpectedHaircutPhotoPath,
  isExpectedOwnerAvatarPath,
  storageObjectNameFromDownloadUrl,
} from "./customerPhotos";
import {
  canUserAccessBranch,
  createSignedQrToken,
  defaultBranchIdForSalon,
  isValidMirrorQr,
  isValidSignedQrToken,
  selectQrBranch,
  shouldReuseActiveSession,
} from "./security";
import {
  ZaloRequestError,
  classifyZaloRequestFailure,
  fetchZaloJson,
  type ZaloRequestCategory,
} from "./zaloClient";
import {
  ZaloGatewayVerificationError,
  createZaloIdentityVerifier,
} from "./zaloIdentityVerifier";
import { decodeZaloPhoneNumber } from "./zaloPhone";
import {
  createZaloPrivacyWebhookHandler,
  type ZaloPrivacyEvent,
  type ZaloPrivacyProcessingResult,
} from "./zaloPrivacyWebhook";
import {
  assertSalonIsOperational,
  createAuthorization,
  salonStatus,
  type AppUser,
  type UserRole,
} from "./authz/authorization";
import { auditEventData } from "./domains/audit/auditEvent";
import {
  PHOTO_UPLOAD_MAX_BYTES,
  PHOTO_UPLOAD_OPERATION_TTL_MS,
  PHOTO_UPLOAD_ORPHAN_TTL_MS,
  buildPhotoUploadOperationId,
  buildPhotoUploadStoragePath,
  isExpectedPhotoUploadPath,
  isPhotoUploadOperationExpired,
  validatePhotoUploadObject,
  validatePhotoUploadBytes,
} from "./domains/photos/photoUploadOperations";
import { apiError } from "./shared/errors";

initializeApp();

const db = getFirestore();
const storage = getStorage();
const {
  assertBranchAccess,
  assertBranchIsOperational,
  assertSalonRole,
  assertSalonRoleIncludingInactiveSalon,
  assertSystemAdmin,
  getAppUser,
} = createAuthorization(db);
const functionOptions = {
  region: "asia-southeast1",
  timeoutSeconds: 60,
  concurrency: 40,
  maxInstances: 50,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true",
};
const zaloAppSecret = defineSecret("ZALO_APP_SECRET");
const zaloGatewayHmacSecret = defineSecret("ZALO_GATEWAY_HMAC_SECRET");
const zaloOpenApiKey = defineSecret("ZALO_OPEN_API_KEY");
const qrSigningSecret = defineSecret("QR_SIGNING_SECRET");
const qrFunctionOptions = {
  ...functionOptions,
  secrets: [qrSigningSecret],
};
const zaloFunctionOptions = {
  ...functionOptions,
  secrets: [zaloAppSecret, zaloGatewayHmacSecret],
  timeoutSeconds: 30,
  concurrency: 40,
  maxInstances: 30,
};
const zaloQrFunctionOptions = {
  ...zaloFunctionOptions,
  secrets: [zaloAppSecret, zaloGatewayHmacSecret, qrSigningSecret],
};
const SESSION_POINT_REQUEST_WINDOW_MS = 12 * 60 * 60 * 1000;
const OPEN_SESSION_STATUSES = ["waiting", "serving", "pending_approval"] as const;
const SESSION_EXPIRY_BATCH_SIZE = 100;
const ZALO_PROFILE_CACHE_TTL_MS = 60_000;
const ZALO_PROFILE_CACHE_MAX_SIZE = 500;
const REWARD_RESTORE_WINDOW_MS = 15 * 60 * 1000;
const DIRECT_POINT_AWARD_DAILY_LIMIT = 100;
const PUBLIC_RATE_LIMITS = {
  resolveCustomerQr: { windowMs: 60_000, tokenLimit: 30, ipLimit: 180 },
  registerCustomerFromZalo: { windowMs: 60_000, tokenLimit: 6, ipLimit: 60 },
  getCustomerSessionFromZalo: { windowMs: 60_000, tokenLimit: 20, ipLimit: 180 },
  getCustomerHistoryFromZalo: { windowMs: 60_000, tokenLimit: 12, ipLimit: 120 },
  getCustomerRewardsFromZalo: { windowMs: 60_000, tokenLimit: 12, ipLimit: 120 },
  spinLuckyWheelFromZalo: { windowMs: 60_000, tokenLimit: 4, ipLimit: 40 },
} as const;

const AUTHENTICATED_RATE_LIMITS = {
  beginHaircutPhotoUpload: 30,
  finalizeHaircutPhotoUpload: 30,
  getRecoverableHaircutPhotoUploads: 60,
  cancelHaircutPhotoUpload: 30,
  submitPointRequest: 20,
  approvePointRequest: 60,
  rejectPointRequest: 60,
  redeemRewardCode: 30,
  spinLuckyWheel: 20,
  claimServiceSession: 60,
  adminMutation: 40,
} as const;

type PublicEndpoint = keyof typeof PUBLIC_RATE_LIMITS;
type AuthenticatedEndpoint = keyof typeof AUTHENTICATED_RATE_LIMITS;

type LuckyWheelSlot = {
  label: string;
  active: boolean;
  type: "reward" | "no_prize";
};

type SpinWheelResult = {
  rewardId: string;
  rewardName: string;
  rewardCode: string;
  isWinning: boolean;
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
    throw apiError(
      "invalid-argument",
      ApiErrorCode.INVALID_REQUEST,
      `Thiếu trường bắt buộc: ${field}`,
      { field },
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > 2_000) {
    throw apiError("invalid-argument", ApiErrorCode.INVALID_REQUEST, `${field} quá dài`, {
      field,
    });
  }
  return trimmed;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw apiError("invalid-argument", ApiErrorCode.INVALID_REQUEST, "Giá trị phải là chuỗi");
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

function requirePointRejectionReason(value: unknown): string {
  const reason = requireString(value, "reason").replace(/\s+/g, " ");
  if (reason.length < 5 || reason.length > 200) {
    throw apiError(
      "invalid-argument",
      ApiErrorCode.INVALID_REQUEST,
      "Lý do từ chối phải có từ 5 đến 200 ký tự",
      { field: "reason" },
    );
  }
  return reason;
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

async function resolveAuthorizedBranchScope(
  user: AppUser,
  salonId: string,
  requestedBranchId: unknown,
): Promise<string | undefined> {
  let branchId = optionalLimitedString(requestedBranchId, "branchId", 128);
  if (!branchId && user.role === "staff") {
    const assignedBranchIds = [
      ...new Set(
        [user.branchId, ...(user.branchIds ?? [])].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
      ),
    ];
    if (assignedBranchIds.length === 1) {
      branchId = assignedBranchIds[0];
    }
  }
  if (!branchId) {
    if (user.role === "staff") {
      throw apiError(
        "invalid-argument",
        ApiErrorCode.INVALID_REQUEST,
        "Vui lòng chọn chi nhánh được phân công",
        { field: "branchId" },
      );
    }
    return undefined;
  }

  await assertBranchAccess(user, branchId);
  const branchSnap = await db.collection("branches").doc(branchId).get();
  assertBranchIsOperational(branchSnap.data(), salonId, branchId);
  return branchId;
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

function safePhotoPaths(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_HAIRCUT_PHOTOS) {
    throw new HttpsError(
      "invalid-argument",
      `Chỉ được gửi tối đa ${MAX_HAIRCUT_PHOTOS} ảnh kiểu tóc`,
    );
  }
  const paths = value.map((item, index) => {
    const path = limitedString(item, `photoPaths[${index}]`, 500);
    if (
      !/^salons\/[A-Za-z0-9_-]{1,128}\/customers\/[A-Za-z0-9_-]{1,128}\/sessions\/[A-Za-z0-9_-]{1,128}\/op-[a-f0-9]{40}\.jpg$/.test(
        path,
      )
    ) {
      throw new HttpsError("invalid-argument", `Đường dẫn ảnh ${index + 1} không hợp lệ`);
    }
    return path;
  });
  if (new Set(paths).size !== paths.length) {
    throw new HttpsError("invalid-argument", "Danh sách ảnh có ảnh bị trùng");
  }
  return paths;
}

function operationIdFromPhotoPath(path: string): string | null {
  const match = path.match(/\/(op-[a-f0-9]{40})\.jpg$/);
  return match?.[1] ?? null;
}

async function assertFinalizedPhotoUploadPaths(input: {
  photoPaths: string[];
  salonId: string;
  branchId: string;
  customerId: string;
  sessionId: string;
  uploaderUid?: string;
}) {
  await Promise.all(
    input.photoPaths.map(async (photoPath, index) => {
      const operationId = operationIdFromPhotoPath(photoPath);
      if (!operationId) {
        throw new HttpsError("invalid-argument", `Đường dẫn ảnh ${index + 1} không hợp lệ`);
      }
      const snap = await db.collection("photo_upload_operations").doc(operationId).get();
      const operation = snap.data();
      const valid =
        snap.exists &&
        operation?.status === "finalized" &&
        operation?.salonId === input.salonId &&
        operation?.branchId === input.branchId &&
        operation?.customerId === input.customerId &&
        operation?.sessionId === input.sessionId &&
        operation?.storagePath === photoPath &&
        (!input.uploaderUid || operation?.staffUid === input.uploaderUid) &&
        isExpectedPhotoUploadPath(photoPath, {
          salonId: input.salonId,
          customerId: input.customerId,
          sessionId: input.sessionId,
          operationId,
        });
      if (!valid) {
        throw new HttpsError("failed-precondition", `Ảnh ${index + 1} chưa được xác nhận hoàn tất`);
      }
    }),
  );
}

async function assertSubmittedHaircutPhotos(input: {
  photoUrls: string[];
  salonId: string;
  branchId: string;
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
        customMetadata.branchId === input.branchId &&
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
  photoPaths?: unknown;
  salonId: string;
  customerId: string;
  sessionId: string;
}) {
  const bucket = storage.bucket();
  const legacyUrls = Array.isArray(input.photoUrls) ? input.photoUrls : [];
  const photoPaths = Array.isArray(input.photoPaths) ? input.photoPaths : [];
  const objectNames = [
    ...legacyUrls.slice(0, MAX_HAIRCUT_PHOTOS).flatMap((value) => {
      if (typeof value !== "string") return [];
      const objectName = storageObjectNameFromDownloadUrl(value, bucket.name);
      return objectName &&
        isExpectedHaircutPhotoPath(objectName, {
          salonId: input.salonId,
          customerId: input.customerId,
          sessionId: input.sessionId,
        })
        ? [objectName]
        : [];
    }),
    ...photoPaths.slice(0, MAX_HAIRCUT_PHOTOS).flatMap((value) => {
      if (typeof value !== "string") return [];
      const operationId = operationIdFromPhotoPath(value);
      return operationId &&
        isExpectedPhotoUploadPath(value, {
          salonId: input.salonId,
          customerId: input.customerId,
          sessionId: input.sessionId,
          operationId,
        })
        ? [value]
        : [];
    }),
  ];
  await Promise.all(
    [...new Set(objectNames)].map(async (objectName, index) => {
      try {
        await bucket.file(objectName).delete({ ignoreNotFound: true });
      } catch {
        console.warn("Không xóa được ảnh kiểu tóc", { photoIndex: index + 1 });
      }
    }),
  );
}

function trustedStoredHaircutPhotoPaths(
  value: unknown,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_HAIRCUT_PHOTOS).filter((path): path is string => {
    if (typeof path !== "string") return false;
    const operationId = operationIdFromPhotoPath(path);
    return Boolean(operationId && isExpectedPhotoUploadPath(path, { ...input, operationId }));
  });
}

async function resolvedHaircutPhotoUrls(
  legacyUrls: unknown,
  photoPaths: unknown,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  const trustedLegacyUrls = trustedStoredHaircutPhotoUrls(legacyUrls, input);
  const trustedPaths = trustedStoredHaircutPhotoPaths(photoPaths, input);
  const expires = Date.now() + 15 * 60 * 1000;
  const signedUrls = await Promise.all(
    trustedPaths.map(async (path) => {
      try {
        const [url] = await storage.bucket().file(path).getSignedUrl({ action: "read", expires });
        return url;
      } catch {
        return null;
      }
    }),
  );
  return [
    ...new Set([...trustedLegacyUrls, ...signedUrls.filter((url): url is string => Boolean(url))]),
  ].slice(0, MAX_HAIRCUT_PHOTOS);
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

function avatarUrlString(value: unknown, salonId: string, ownerUid: string): string {
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

  const objectName = storageObjectNameFromDownloadUrl(trimmed, storage.bucket().name);
  if (!objectName || !isExpectedOwnerAvatarPath(objectName, { salonId, ownerUid })) {
    throw new HttpsError(
      "invalid-argument",
      "Avatar phải là ảnh đã tải lên đúng thư mục của chủ salon",
    );
  }

  return trimmed;
}

function trustedStoredSalonAvatarUrl(value: unknown, salonId: string): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const objectName = storageObjectNameFromDownloadUrl(trimmed, storage.bucket().name);
  return objectName && isExpectedSalonAvatarPath(objectName, salonId) ? trimmed : "";
}

function salonAvatarUrlString(
  value: unknown,
  salonId: string,
): {
  salonAvatarUrl: string;
  objectName: string | null;
} {
  if (value === undefined || value === null || value === "") {
    return { salonAvatarUrl: "", objectName: null };
  }
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Ảnh đại diện salon không hợp lệ");
  }

  const salonAvatarUrl = value.trim();
  if (!salonAvatarUrl) {
    return { salonAvatarUrl: "", objectName: null };
  }
  if (salonAvatarUrl.length > 700) {
    throw new HttpsError("invalid-argument", "Đường dẫn ảnh đại diện salon quá dài");
  }

  const objectName = storageObjectNameFromDownloadUrl(salonAvatarUrl, storage.bucket().name);
  if (!objectName || !isExpectedSalonAvatarPath(objectName, salonId)) {
    throw new HttpsError(
      "invalid-argument",
      "Ảnh đại diện phải được tải lên đúng thư mục của salon",
    );
  }

  return { salonAvatarUrl, objectName };
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

function requireBoundedPositiveNumber(value: unknown, field: string, max: number): number {
  const result = requirePositiveNumber(value, field);
  if (result > max) {
    throw new HttpsError("invalid-argument", `${field} không được lớn hơn ${max}`);
  }
  return result;
}

function requireIdempotencyKey(value: unknown): string {
  const key = limitedString(value, "idempotencyKey", 128);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new HttpsError("invalid-argument", "Mã chống gửi lặp không hợp lệ");
  }
  return key;
}

function currentUid(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw apiError("unauthenticated", ApiErrorCode.UNAUTHENTICATED, "Bạn cần đăng nhập");
  }
  return auth.uid;
}

function assertAdminWriteOperationsEnabled() {
  if (process.env.ADMIN_WRITE_OPERATIONS_ENABLED !== "true") {
    throw apiError(
      "failed-precondition",
      ApiErrorCode.ADMIN_WRITE_DISABLED,
      "Admin đang ở chế độ chỉ đọc",
    );
  }
}

function assertRecentAuthentication(
  auth: { token?: Record<string, unknown> } | undefined,
  maxAgeMs = 5 * 60 * 1000,
) {
  const authTimeSeconds = Number(auth?.token?.auth_time ?? 0);
  if (
    !Number.isFinite(authTimeSeconds) ||
    authTimeSeconds <= 0 ||
    Date.now() - authTimeSeconds * 1000 > maxAgeMs
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Vui lòng nhập lại mật khẩu trước khi xóa tài khoản hoặc salon",
      { errorCode: "RECENT_LOGIN_REQUIRED" },
    );
  }
}

async function getSystemFeatures(salonId: string): Promise<SystemFeatures> {
  const [systemSnap, salonSnap] = await Promise.all([
    db.collection("system_config").doc("features").get(),
    db.collection("salons").doc(salonId).collection("settings").doc("features").get(),
  ]);
  return normalizeSystemFeatures(systemSnap.data(), salonSnap.data());
}

async function assertFeatureEnabled(
  salonId: string,
  feature: keyof Pick<
    SystemFeatures,
    | "checkinEnabled"
    | "luckyWheelEnabled"
    | "rewardRedeemEnabled"
    | "photoUploadEnabled"
    | "pointApprovalEnabled"
  >,
  disabledMessage: string,
  appVersionInput?: unknown,
) {
  const features = await getSystemFeatures(salonId);
  assertSupportedAppVersion(features, appVersionInput);
  if (features.maintenanceMode) {
    throw new HttpsError("unavailable", "Hệ thống đang bảo trì. Vui lòng thử lại sau.", {
      errorCode: ApiErrorCode.MAINTENANCE_MODE,
    });
  }
  if (!features[feature]) {
    throw new HttpsError("failed-precondition", disabledMessage, {
      errorCode: ApiErrorCode.FEATURE_DISABLED,
      feature,
    });
  }
  return features;
}

function assertSupportedAppVersion(features: SystemFeatures, value: unknown) {
  const minimum = parseAppVersion(features.minimumSupportedAppVersion);
  if (!minimum) return;
  const current = parseAppVersion(value);
  if (!current || compareAppVersions(current, minimum) < 0) {
    throw new HttpsError(
      "failed-precondition",
      "Phiên bản ứng dụng đã quá cũ. Vui lòng cập nhật.",
      {
        errorCode: ApiErrorCode.APP_VERSION_UNSUPPORTED,
        minimumSupportedAppVersion: features.minimumSupportedAppVersion,
        recommendedAppVersion: features.recommendedAppVersion,
      },
    );
  }
}

function parseAppVersion(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareAppVersions(left: [number, number, number], right: [number, number, number]) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function parseFeaturePatch(value: unknown): Partial<SystemFeatures> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Cấu hình tính năng không hợp lệ");
  }
  const input = value as Record<string, unknown>;
  const booleanKeys = [
    "checkinEnabled",
    "luckyWheelEnabled",
    "rewardRedeemEnabled",
    "photoUploadEnabled",
    "pointApprovalEnabled",
    "maintenanceMode",
  ] as const;
  const versionKeys = ["minimumSupportedAppVersion", "recommendedAppVersion"] as const;
  const allowedKeys = new Set<string>([...booleanKeys, ...versionKeys]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new HttpsError("invalid-argument", "Cấu hình chứa trường không được hỗ trợ");
  }

  const patch: Partial<SystemFeatures> = {};
  booleanKeys.forEach((key) => {
    if (key in input) {
      if (typeof input[key] !== "boolean") {
        throw new HttpsError("invalid-argument", `${key} phải là đúng/sai`);
      }
      patch[key] = input[key];
    }
  });
  versionKeys.forEach((key) => {
    if (key in input) {
      if (typeof input[key] !== "string" || String(input[key]).trim().length > 32) {
        throw new HttpsError("invalid-argument", `${key} không hợp lệ`);
      }
      patch[key] = String(input[key]).trim();
    }
  });
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "Chưa có cấu hình nào để cập nhật");
  }
  return patch;
}

function deviceTokenId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendManagerPush(input: {
  salonId: string;
  title: string;
  body: string;
  data: Record<string, string>;
  role?: UserRole;
  uid?: string;
  branchId?: string;
}) {
  const tokensSnap = await db
    .collection("device_tokens")
    .where("salonId", "==", input.salonId)
    .where("isActive", "==", true)
    .limit(500)
    .get();
  const tokenDocs = tokensSnap.docs.filter((tokenDoc) => {
    const token = tokenDoc.data();
    if (input.uid && token.uid !== input.uid) {
      return false;
    }
    if (input.role && token.role !== input.role) {
      return false;
    }
    if (input.branchId && token.role === "staff" && !Array.isArray(token.branchIds)) {
      return false;
    }
    if (input.branchId && token.role === "staff" && !token.branchIds.includes(input.branchId)) {
      return false;
    }
    return typeof token.token === "string" && token.token.length >= 16;
  });
  const uniqueTokens = [...new Set(tokenDocs.map((tokenDoc) => String(tokenDoc.data().token)))];
  if (uniqueTokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title: input.title, body: input.body },
    data: input.data,
  });
  const invalidCodes = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
  ]);
  const cleanup = db.batch();
  let cleanupCount = 0;
  response.responses.forEach((result, index) => {
    if (!result.success && invalidCodes.has(String(result.error?.code || ""))) {
      const token = uniqueTokens[index];
      cleanup.set(
        db.collection("device_tokens").doc(deviceTokenId(token)),
        {
          isActive: false,
          disabledReason: "invalid_registration",
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      cleanupCount += 1;
    }
  });
  if (cleanupCount > 0) {
    await cleanup.commit();
  }
  return { sent: response.successCount, failed: response.failureCount };
}

async function resolveStaffBranchIds(salonId: string, value: unknown): Promise<string[]> {
  const requested = Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  let branchIds = requested;
  if (branchIds.length === 0) {
    const activeBranches = await db
      .collection("branches")
      .where("salonId", "==", salonId)
      .where("isActive", "==", true)
      .limit(2)
      .get();
    if (activeBranches.size === 1) {
      branchIds = [activeBranches.docs[0].id];
    }
  }

  if (branchIds.length === 0 || branchIds.length > 20) {
    throw new HttpsError("invalid-argument", "Hãy chọn ít nhất một chi nhánh cho nhân viên");
  }

  const branchSnaps = await Promise.all(
    branchIds.map((branchId) => db.collection("branches").doc(branchId).get()),
  );
  if (
    branchSnaps.some(
      (snap) => !snap.exists || snap.data()?.salonId !== salonId || snap.data()?.isActive !== true,
    )
  ) {
    throw new HttpsError("failed-precondition", "Chi nhánh phân công không hợp lệ hoặc đã khóa");
  }

  return branchIds;
}

function customerIdFor(salonId: string, zaloUserId: string): string {
  return createHash("sha256").update(`${salonId}:${zaloUserId}`).digest("hex").slice(0, 40);
}

function activeSessionRefFor(salonId: string, customerId: string) {
  const id = createHash("sha256").update(`${salonId}:${customerId}`).digest("hex").slice(0, 40);
  return db.collection("active_service_sessions").doc(id);
}

function customerDeletionJobRefFor(salonId: string, customerId: string) {
  const id = createHash("sha256")
    .update(`customer-deletion:${salonId}:${customerId}`)
    .digest("hex");
  return db.collection("customer_deletion_jobs").doc(id);
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
        throw apiError(
          "resource-exhausted",
          ApiErrorCode.RATE_LIMITED,
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

async function enforceAuthenticatedRateLimit(
  endpoint: AuthenticatedEndpoint,
  uid: string,
  salonId: string,
) {
  const windowMs = 60_000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const id = createHash("sha256")
    .update(`${endpoint}:${uid}:${salonId}:${windowStart}`)
    .digest("hex");
  const ref = db.collection("_authenticated_rate_limits").doc(id);
  const limit = AUTHENTICATED_RATE_LIMITS[endpoint];
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (Number(snapshot.data()?.count ?? 0) >= limit) {
      throw new HttpsError("resource-exhausted", "Bạn thao tác quá nhanh. Vui lòng thử lại sau.", {
        errorCode: ApiErrorCode.RATE_LIMITED,
      });
    }
    tx.set(
      ref,
      {
        endpoint,
        uidHash: createHash("sha256").update(uid).digest("hex"),
        salonIdHash: createHash("sha256").update(salonId).digest("hex"),
        count: FieldValue.increment(1),
        expiresAt: Timestamp.fromMillis(windowStart + 2 * windowMs),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  });
}

const ZALO_VERIFICATION_USER_MESSAGE =
  "Không thể xác minh tài khoản Zalo lúc này. Vui lòng thử lại sau.";

type ZaloVerificationContext = {
  requestId?: string;
  functionName?: string;
};

function createZaloVerificationRequestId() {
  return `zalo_${randomBytes(12).toString("hex")}`;
}

async function verifyZaloAccessTokenDirect(
  accessTokenInput: unknown,
  context: ZaloVerificationContext = {},
): Promise<ZaloProfile> {
  const accessToken = requireString(accessTokenInput, "zaloAccessToken");
  const requestId = context.requestId || createZaloVerificationRequestId();
  const functionName = context.functionName || "zaloCustomerCallable";
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
  endpoint.searchParams.set("fields", "id");

  let payload: Record<string, unknown>;
  let responseStatus: number | "network-error" = "network-error";
  let responseErrorCode: string | number = "request-failed";
  let responseAttempt = 1;
  const safeLogMessage = (value: unknown) => {
    let message = String(value || "Không xác minh được Zalo access token");
    for (const sensitiveValue of [accessToken, appSecret, appsecretProof]) {
      message = message.split(sensitiveValue).join("[redacted]");
    }
    return message.slice(0, 500);
  };
  const logVerificationFailure = (
    errorCode: string | number,
    message: string,
    category: ZaloRequestCategory,
    attempt: number,
  ) => {
    console.warn("zalo_identity_verification_failed", {
      event: "zalo_identity_verification_failed",
      requestId,
      function: functionName,
      region: functionOptions.region,
      status: responseStatus,
      errorCode,
      category,
      attempt,
      timestamp: new Date().toISOString(),
      message: safeLogMessage(message),
    });
  };

  try {
    const result = await fetchZaloJson(endpoint, {
      access_token: accessToken,
      appsecret_proof: appsecretProof,
    }, {
      onAttemptFailure: (event) => {
        console.warn("zalo_identity_verification_attempt_failed", {
          event: "zalo_identity_verification_attempt_failed",
          requestId,
          function: functionName,
          region: functionOptions.region,
          status: event.status,
          errorCode: event.errorCode,
          category: event.category,
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          retryable: event.retryable,
          timestamp: new Date().toISOString(),
        });
      },
    });
    payload = result.payload;
    responseStatus = result.status;
    responseErrorCode = result.errorCode;
    responseAttempt = result.attempt;
  } catch (error) {
    if (error instanceof ZaloRequestError) {
      responseStatus = error.status;
      responseErrorCode = error.errorCode;
    }
    const message =
      error instanceof Error ? error.message : "Không xác minh được Zalo access token";
    const category =
      error instanceof ZaloRequestError
        ? error.category
        : classifyZaloRequestFailure(message);
    const attempt = error instanceof ZaloRequestError ? error.attempt : 1;
    logVerificationFailure(responseErrorCode, message, category, attempt);
    throw new HttpsError("unauthenticated", ZALO_VERIFICATION_USER_MESSAGE, {
      errorCode: "ZALO_VERIFICATION_FAILED",
      requestId,
      category,
    });
  }

  const errorCode = Number(payload.error ?? 0);
  if (Number.isFinite(errorCode) && errorCode !== 0) {
    const message = String(payload.message ?? "Zalo access token không hợp lệ");
    const category = classifyZaloRequestFailure(message);
    logVerificationFailure(errorCode, message, category, responseAttempt);
    throw new HttpsError("unauthenticated", ZALO_VERIFICATION_USER_MESSAGE, {
      errorCode: "ZALO_VERIFICATION_FAILED",
      requestId,
      category,
    });
  }

  const zaloUserId = String(payload.id ?? "").trim();
  if (!zaloUserId) {
    const message = "Zalo không trả về user id hợp lệ";
    logVerificationFailure("missing-user-id", message, "INVALID_RESPONSE", 1);
    throw new HttpsError("unauthenticated", ZALO_VERIFICATION_USER_MESSAGE, {
      errorCode: "ZALO_VERIFICATION_FAILED",
      requestId,
      category: "INVALID_RESPONSE",
    });
  }

  const profile = { zaloUserId };
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

async function verifyZaloAccessToken(
  accessTokenInput: unknown,
  context: ZaloVerificationContext = {},
): Promise<ZaloProfile> {
  const accessToken = requireString(accessTokenInput, "zaloAccessToken");
  const requestId = context.requestId || createZaloVerificationRequestId();
  const appSecret =
    zaloAppSecret.value() || process.env.ZALO_APP_SECRET || process.env.ZALO_SECRET_KEY || "";
  if (!appSecret || appSecret.includes("your-")) {
    throw new HttpsError(
      "failed-precondition",
      "Thiếu ZALO_APP_SECRET để xác minh danh tính Zalo ở server",
    );
  }
  const mode = String(process.env.ZALO_VERIFIER_MODE || "").trim().toLowerCase();
  let verifier;
  try {
    verifier = createZaloIdentityVerifier({
      mode,
      gatewayUrl: process.env.ZALO_GATEWAY_URL,
      gatewayKeyId: process.env.ZALO_GATEWAY_KEY_ID,
      gatewayHmacSecret: process.env.ZALO_GATEWAY_HMAC_SECRET,
      zaloAppSecret: appSecret,
      directVerify: ({ accessToken: directToken }) =>
        verifyZaloAccessTokenDirect(directToken, { ...context, requestId }),
    });
  } catch {
    throw new HttpsError(
      "failed-precondition",
      "Máy chủ chưa được cấu hình đầy đủ để xác minh danh tính Zalo",
      { errorCode: "ZALO_VERIFIER_CONFIGURATION_INVALID", requestId },
    );
  }
  try {
    return await verifier.verify({ accessToken, requestId });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const gatewayCode =
      error instanceof ZaloGatewayVerificationError ? error.code : "ZALO_UNAVAILABLE";
    console.warn("zalo_gateway_verification_failed", {
      event: "zalo_gateway_verification_failed",
      requestId,
      function: context.functionName || "zaloCustomerCallable",
      errorCode: gatewayCode,
      timestamp: new Date().toISOString(),
    });
    throw new HttpsError("unauthenticated", ZALO_VERIFICATION_USER_MESSAGE, {
      errorCode: "ZALO_VERIFICATION_FAILED",
      requestId,
      category: gatewayCode,
    });
  }
}

function last4(phone?: string): string | undefined {
  if (!phone) {
    return undefined;
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

async function migrateCustomerSearchFields(salonId: string): Promise<number> {
  const markerId = createHash("sha256").update(`name-prefixes-v1:${salonId}`).digest("hex");
  const markerRef = db.collection("_customer_search_migrations").doc(markerId);
  const markerSnap = await markerRef.get();
  if (markerSnap.data()?.complete === true) {
    return 0;
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
  let updated = 0;
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
      updated += 1;
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
  return updated;
}

async function ensureSalonCustomerCount(salonId: string): Promise<void> {
  const salonRef = db.collection("salons").doc(salonId);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }
  if (Number.isInteger(salonSnap.data()?.customerCount)) {
    return;
  }

  const countSnap = await db.collection("customers").where("salonId", "==", salonId).count().get();
  const currentCount = countSnap.data().count;
  await db.runTransaction(async (tx) => {
    const currentSalon = await tx.get(salonRef);
    if (!currentSalon.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
    if (!Number.isInteger(currentSalon.data()?.customerCount)) {
      tx.set(
        salonRef,
        { customerCount: currentCount, updatedAt: Timestamp.now() },
        { merge: true },
      );
    }
  });
}

function assertCustomerQuota(salon: DocumentData) {
  const customerCount = Math.max(0, Math.floor(Number(salon.customerCount ?? 0)));
  const freeCustomerLimit = Math.max(1, Math.floor(Number(salon.freeCustomerLimit ?? 50)));
  if (!canCreateCustomerWithinPlan({ plan: salon.plan, customerCount, freeCustomerLimit })) {
    throw new HttpsError(
      "resource-exhausted",
      `Salon đã đạt giới hạn ${freeCustomerLimit} khách của gói hiện tại`,
    );
  }
  return customerCount;
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

function qrVersion(value: unknown): number {
  const parsed = Math.floor(Number(value ?? 1));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function signedQrUrl(input: {
  kind: "salon" | "branch";
  salonId: string;
  branchId?: string;
  version: number;
}) {
  const secret = qrSigningSecret.value();
  if (secret.length < 32) {
    throw new HttpsError(
      "failed-precondition",
      "QR_SIGNING_SECRET chưa được cấu hình đúng trên Firebase",
    );
  }

  const qrToken = createSignedQrToken(secret, input);
  const params = new URLSearchParams({
    qrType: input.kind,
    salonId: input.salonId,
    qrToken,
  });
  if (input.kind === "branch" && input.branchId) {
    params.set("branchId", input.branchId);
  }

  const miniAppId = process.env.ZALO_MINI_APP_ID || "your-mini-app-id";
  return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
}

function publicBranch(doc: { id: string; data(): DocumentData }) {
  const data = doc.data();
  return {
    id: doc.id,
    name: String(data.name || "Chi nhánh"),
    address: String(data.address || ""),
    phone: String(data.phone || ""),
    isActive: data.isActive === true,
  };
}

type CustomerQrResolution = {
  qrType: "salon" | "branch" | "legacy-mirror";
  salonId: string;
  salonName: string;
  salonAvatarUrl: string;
  branchId: string | null;
  branchName: string;
  branchAddress: string;
  selectionRequired: boolean;
  branches: Array<ReturnType<typeof publicBranch>>;
  features: SystemFeatures;
  legacyMirrorId?: string;
};

async function resolveCustomerQrData(data: unknown): Promise<CustomerQrResolution> {
  const input = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const salonId = requireString(input.salonId, "salonId");
  const qrToken = requireString(input.qrToken, "qrToken");
  const requestedType = optionalString(input.qrType);
  const branchId = optionalString(input.branchId);
  const mirrorId = optionalString(input.mirrorId);
  const qrType =
    requestedType === "salon" || requestedType === "branch"
      ? requestedType
      : mirrorId
        ? "legacy-mirror"
        : "salon";
  const salonSnap = await db.collection("salons").doc(salonId).get();

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Salon không tồn tại hoặc đã ngừng hoạt động");
  }

  const salonName = String(salonSnap.data()?.name || "Salon");
  const salonAvatarUrl = trustedStoredSalonAvatarUrl(salonSnap.data()?.avatarUrl, salonId);
  assertSalonIsOperational(salonSnap.data());
  const features = await getSystemFeatures(salonId);
  const secret = qrSigningSecret.value();
  if (secret.length < 32) {
    throw new HttpsError("failed-precondition", "QR của salon chưa được cấu hình");
  }

  if (qrType === "legacy-mirror") {
    const mirrorSnap = await db
      .collection("mirrors")
      .doc(requireString(mirrorId, "mirrorId"))
      .get();
    if (!mirrorSnap.exists || !isValidMirrorQr(mirrorSnap.data(), salonId, qrToken)) {
      throw new HttpsError("permission-denied", "QR Gương 1 không hợp lệ hoặc đã bị khóa");
    }

    const resolvedBranchId =
      optionalString(mirrorSnap.data()?.branchId) ?? defaultBranchIdForSalon(salonId);
    const branchSnap = await db.collection("branches").doc(resolvedBranchId).get();
    if (
      !branchSnap.exists ||
      branchSnap.data()?.salonId !== salonId ||
      branchSnap.data()?.isActive !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "QR cũ chưa được chuyển sang chi nhánh hoặc chi nhánh đã bị khóa",
      );
    }
    const branch = publicBranch(branchSnap as { id: string; data(): DocumentData });
    return {
      qrType,
      salonId,
      salonName,
      salonAvatarUrl,
      branchId: branch.id,
      branchName: branch.name,
      branchAddress: branch.address,
      selectionRequired: false,
      branches: [branch],
      features,
      legacyMirrorId: mirrorSnap.id,
    };
  }

  if (qrType === "branch") {
    const resolvedBranchId = requireString(branchId, "branchId");
    const branchSnap = await db.collection("branches").doc(resolvedBranchId).get();
    if (
      !branchSnap.exists ||
      branchSnap.data()?.salonId !== salonId ||
      branchSnap.data()?.isActive !== true
    ) {
      throw new HttpsError("failed-precondition", "Chi nhánh không tồn tại hoặc đã bị khóa");
    }
    const valid = isValidSignedQrToken(
      secret,
      {
        kind: "branch",
        salonId,
        branchId: resolvedBranchId,
        version: qrVersion(branchSnap.data()?.qrVersion),
      },
      qrToken,
    );
    if (!valid) {
      throw new HttpsError("permission-denied", "QR chi nhánh không hợp lệ hoặc đã được tạo lại");
    }
    const branch = publicBranch(branchSnap as { id: string; data(): DocumentData });
    return {
      qrType,
      salonId,
      salonName,
      salonAvatarUrl,
      branchId: branch.id,
      branchName: branch.name,
      branchAddress: branch.address,
      selectionRequired: false,
      branches: [branch],
      features,
    };
  }

  const validSalonQr = isValidSignedQrToken(
    secret,
    { kind: "salon", salonId, version: qrVersion(salonSnap.data()?.salonQrVersion) },
    qrToken,
  );
  if (!validSalonQr) {
    throw new HttpsError("permission-denied", "QR salon không hợp lệ hoặc đã được tạo lại");
  }

  const branchSnaps = await db
    .collection("branches")
    .where("salonId", "==", salonId)
    .limit(100)
    .get();
  const branches = branchSnaps.docs
    .map(publicBranch)
    .filter((branch) => branch.isActive)
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
  const selection = selectQrBranch(branches, branchId);
  if (selection.mode === "invalid") {
    throw new HttpsError("failed-precondition", "Chi nhánh đã chọn không còn hoạt động");
  }
  const selected = branches.find((branch) => branch.id === selection.branchId);

  return {
    qrType,
    salonId,
    salonName,
    salonAvatarUrl,
    branchId: selected?.id ?? null,
    branchName: selected?.name ?? "",
    branchAddress: selected?.address ?? "",
    selectionRequired: selection.mode === "choose",
    branches,
    features,
  };
}

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function isFreshServiceSession(createdAt: unknown, now: Timestamp, expiresAt?: unknown): boolean {
  const createdAtMs = timestampMillis(createdAt);

  if (!createdAtMs) {
    return false;
  }

  const nowMs = now.toMillis();
  const expiresAtMs =
    timestampMillis(expiresAt) ??
    serviceSessionExpiresAtMs(createdAtMs, SESSION_POINT_REQUEST_WINDOW_MS);
  return (
    createdAtMs <= nowMs + 5 * 60 * 1000 &&
    nowMs - createdAtMs <= SESSION_POINT_REQUEST_WINDOW_MS &&
    !isServiceSessionExpired(expiresAtMs, nowMs)
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

function bangkokDateKey(timestampMs: number): string {
  return new Date(timestampMs + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function spinWheelForCustomer(
  salonId: string,
  customerId: string,
  idempotencyKey: string,
  appVersion: unknown,
): Promise<SpinWheelResult> {
  await assertFeatureEnabled(
    salonId,
    "luckyWheelEnabled",
    "Vòng quay đang tạm ngừng. Vui lòng quay lại sau.",
    appVersion,
  );
  const wheelRef = db.collection("lucky_wheel").doc(salonId);
  const customerRef = db.collection("customers").doc(customerId);
  const operationId = createHash("sha256")
    .update(`spin:${salonId}:${customerId}:${idempotencyKey}`)
    .digest("hex");
  const operationRef = db.collection("idempotency_keys").doc(operationId);
  const rewardRef = db.collection("reward_history").doc(operationId);
  const now = Timestamp.now();

  let selectedReward = "";
  let selectedCode = "";
  let isWinning = true;
  let selectedIndex = 0;
  let pointsAfter = 0;

  await db.runTransaction(async (tx) => {
    const [operationSnap, wheelSnap, customerSnap] = await Promise.all([
      tx.get(operationRef),
      tx.get(wheelRef),
      tx.get(customerRef),
    ]);
    if (operationSnap.exists) {
      const operation = operationSnap.data();
      if (
        operation?.operation !== "wheel.spin" ||
        operation?.salonId !== salonId ||
        operation?.customerId !== customerId
      ) {
        throw new HttpsError("already-exists", "Mã chống gửi lặp đã được sử dụng");
      }
      const response = operation.response as Partial<SpinWheelResult> | undefined;
      selectedReward = String(response?.rewardName || "");
      selectedCode = String(response?.rewardCode || "");
      isWinning = response?.isWinning === true;
      selectedIndex = Number(response?.selectedIndex ?? 0);
      pointsAfter = Number(response?.pointsAfter ?? 0);
      return;
    }
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

    const wheelSlots = Array.isArray(wheel?.slots)
      ? wheel.slots.map((slot: LuckyWheelSlot) => ({
          label: String(slot.label || "").trim(),
          active: slot.active !== false,
          type: normalizeWheelSlotType(slot.type, String(slot.label || "")),
        }))
      : [];
    const availableSlotCount = activeWheelSlotCount(wheelSlots);
    const selectedSlot =
      availableSlotCount > 0
        ? selectWheelSlotByIndex(wheelSlots, randomInt(availableSlotCount))
        : null;
    if (!selectedSlot) {
      throw new HttpsError("failed-precondition", "Vòng quay chưa có ô thưởng đang bật");
    }

    selectedIndex = selectedSlot.index;
    selectedReward = selectedSlot.label;
    const rewardOutcome = wheelRewardOutcome(selectedSlot.type, rewardCode(rewardRef.id));
    isWinning = rewardOutcome.isWinning;
    selectedCode = rewardOutcome.rewardCode ?? "";
    const deductPoints = Boolean(wheel?.deductPointsAfterSpin);
    pointsAfter = deductPoints ? points - requiredPoints : points;
    const branchId = String(customer?.lastBranchId || defaultBranchIdForSalon(salonId));
    const rewardValidityDays = Math.min(
      Math.max(Math.floor(Number(wheel?.rewardValidityDays ?? 90)), 1),
      365,
    );
    const expiresAt = rewardOutcome.isWinning
      ? Timestamp.fromMillis(rewardExpiresAtMs(now.toMillis(), rewardValidityDays))
      : null;

    tx.set(rewardRef, {
      salonId,
      branchId,
      branchName: String(customer?.lastBranchName || "Chi nhánh chính"),
      customerId,
      rewardName: selectedReward,
      rewardCode: rewardOutcome.rewardCode,
      isWinning,
      selectedIndex,
      pointsSpent: deductPoints ? requiredPoints : 0,
      status: rewardOutcome.status,
      expiresAt,
      createdAt: now,
    });

    if (deductPoints) {
      tx.update(customerRef, {
        points: FieldValue.increment(-requiredPoints),
        updatedAt: now,
      });
    }
    tx.set(operationRef, {
      operation: "wheel.spin",
      salonId,
      customerId,
      response: {
        rewardId: rewardRef.id,
        rewardName: selectedReward,
        rewardCode: selectedCode,
        isWinning,
        pointsAfter,
        selectedIndex,
      },
      createdAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  return {
    rewardId: rewardRef.id,
    rewardName: selectedReward,
    rewardCode: selectedCode,
    isWinning,
    pointsAfter,
    selectedIndex,
  };
}

export const createSalon = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const authUser = await getAuth().getUser(uid);
  if (!isVerifiedOwnerIdentity(authUser)) {
    throw new HttpsError(
      "failed-precondition",
      "Hãy xác minh email chủ salon rồi đăng nhập lại trước khi tạo salon",
    );
  }
  const name = limitedString(request.data?.name, "name", 120);
  const ownerName = optionalLimitedString(request.data?.ownerName, "ownerName", 80) ?? name;
  const address = optionalLimitedString(request.data?.address, "address", 200);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);

  const salonRef = db.collection("salons").doc();
  const userRef = db.collection("users").doc(uid);
  const wheelRef = db.collection("lucky_wheel").doc(salonRef.id);
  const branchId = defaultBranchIdForSalon(salonRef.id);
  const branchRef = db.collection("branches").doc(branchId);
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
      customerCount: 0,
      pointPerVisit: 1,
      salonQrVersion: 1,
      defaultBranchId: branchId,
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
        canAwardPointsDirectly: true,
        branchIds: [],
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(wheelRef, {
      salonId: salonRef.id,
      requiredPoints: 5,
      rewardValidityDays: 90,
      deductPointsAfterSpin: true,
      slots: [
        { label: "Giảm 10%", active: true, type: "reward" },
        { label: "Gội đầu miễn phí", active: true, type: "reward" },
        { label: "Tặng sáp tóc", active: true, type: "reward" },
        { label: "Giảm 20%", active: true, type: "reward" },
        { label: "Chúc bạn may mắn", active: true, type: "no_prize" },
        { label: "Hấp dầu miễn phí", active: true, type: "reward" },
      ],
      updatedAt: now,
    });
    tx.set(branchRef, {
      salonId: salonRef.id,
      name: "Chi nhánh chính",
      address: address ?? null,
      phone: phone ?? null,
      isActive: true,
      qrVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    salonId: salonRef.id,
    branchId,
    salonQrUrl: signedQrUrl({ kind: "salon", salonId: salonRef.id, version: 1 }),
    branchQrUrl: signedQrUrl({
      kind: "branch",
      salonId: salonRef.id,
      branchId,
      version: 1,
    }),
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
  const canAwardPointsDirectly = Boolean(request.data?.canAwardPointsDirectly);
  const branchIds = await resolveStaffBranchIds(salonId, request.data?.branchIds);
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

    const staffRef = db.collection("users").doc(staffUid);
    const batch = db.batch();
    batch.set(staffRef, {
      salonId,
      name,
      email,
      phone: phone ?? null,
      role: "staff",
      isActive: true,
      canRedeemRewards,
      canAwardPointsDirectly,
      branchId: branchIds[0],
      branchIds,
      inviteStatus: "pending",
      invitedBy: uid,
      invitedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "staff.created",
        targetType: "user",
        targetId: staffUid,
        after: { isActive: true, canRedeemRewards, canAwardPointsDirectly, branchIds },
        createdAt: now,
      }),
    );
    await batch.commit();

    return { uid: staffUid, email, branchIds };
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

export const acceptStaffInvite = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const authenticatedEmail =
    typeof request.auth?.token.email === "string"
      ? request.auth.token.email.trim().toLowerCase()
      : "";
  const appUser = await getAppUser(uid);
  if (appUser.role !== "staff") {
    throw apiError(
      "permission-denied",
      ApiErrorCode.FORBIDDEN,
      "Chỉ tài khoản nhân viên mới có thể xác nhận lời mời",
    );
  }

  const staffRef = db.collection("users").doc(uid);
  const salonRef = db.collection("salons").doc(appUser.salonId);
  const now = Timestamp.now();
  const result = await db.runTransaction(async (tx) => {
    const [staffSnap, salonSnap] = await Promise.all([tx.get(staffRef), tx.get(salonRef)]);
    const staff = staffSnap.data();
    if (
      !staffSnap.exists ||
      staff?.role !== "staff" ||
      staff?.salonId !== appUser.salonId ||
      staff?.isActive !== true
    ) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Lời mời nhân viên không còn hợp lệ",
      );
    }
    if (!salonSnap.exists) {
      throw apiError(
        "not-found",
        ApiErrorCode.INVALID_SALON,
        "Không tìm thấy salon của lời mời nhân viên",
      );
    }
    assertSalonIsOperational(salonSnap.data());

    const invitedEmail = typeof staff.email === "string" ? staff.email.trim().toLowerCase() : "";
    if (invitedEmail && (!authenticatedEmail || authenticatedEmail !== invitedEmail)) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Email đăng nhập không khớp với lời mời nhân viên",
      );
    }

    if (staff.inviteStatus === "accepted") {
      return { accepted: true, alreadyAccepted: true };
    }
    if (staff.inviteStatus !== "pending") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_REQUEST,
        "Lời mời nhân viên không ở trạng thái chờ xác nhận",
      );
    }

    tx.set(
      staffRef,
      {
        inviteStatus: "accepted",
        inviteAcceptedAt: now,
        acceptedBy: uid,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId: appUser.salonId,
        actorId: uid,
        actorRole: "staff",
        action: "staff.invite_accepted",
        targetType: "user",
        targetId: uid,
        before: { inviteStatus: "pending" },
        after: { inviteStatus: "accepted" },
        createdAt: now,
      }),
    );
    return { accepted: true, alreadyAccepted: false };
  });

  return result;
});

export const createMirror = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const name = limitedString(request.data?.name, "name", 80);
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

  const name = optionalLimitedString(request.data?.name, "name", 80);
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

export const listBranches = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const [salonSnap, branchesSnap] = await Promise.all([
    db.collection("salons").doc(salonId).get(),
    db.collection("branches").where("salonId", "==", salonId).limit(100).get(),
  ]);

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  const branches = branchesSnap.docs
    .filter((branch) => user.role === "owner" || canUserAccessBranch(user, branch.id))
    .map((branch) => {
      const result = publicBranch(branch);
      return {
        ...result,
        qrUrl:
          user.role === "owner"
            ? signedQrUrl({
                kind: "branch",
                salonId,
                branchId: branch.id,
                version: qrVersion(branch.data().qrVersion),
              })
            : "",
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));

  return {
    salonQrUrl:
      user.role === "owner"
        ? signedQrUrl({
            kind: "salon",
            salonId,
            version: qrVersion(salonSnap.data()?.salonQrVersion),
          })
        : "",
    branches,
  };
});

export const createBranch = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);
  const name = limitedString(request.data?.name, "name", 80);
  const address = optionalLimitedString(request.data?.address, "address", 200);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const branchRef = db.collection("branches").doc();
  const now = Timestamp.now();

  const batch = db.batch();
  batch.set(branchRef, {
    salonId,
    name,
    address: address ?? null,
    phone: phone ?? null,
    isActive: true,
    qrVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "branch.created",
      targetType: "branch",
      targetId: branchRef.id,
      after: { name, isActive: true, qrVersion: 1 },
      createdAt: now,
    }),
  );
  await batch.commit();

  return {
    id: branchRef.id,
    salonId,
    name,
    address: address ?? "",
    phone: phone ?? "",
    isActive: true,
    qrUrl: signedQrUrl({ kind: "branch", salonId, branchId: branchRef.id, version: 1 }),
  };
});

export const updateBranch = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = requireString(request.data?.branchId, "branchId");
  await assertSalonRole(uid, salonId, ["owner"]);
  const branchRef = db.collection("branches").doc(branchId);
  const branchSnap = await branchRef.get();

  if (!branchSnap.exists || branchSnap.data()?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy chi nhánh");
  }

  const payload: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (request.data?.name !== undefined) {
    payload.name = limitedString(request.data.name, "name", 80);
  }
  if (request.data?.address !== undefined) {
    payload.address = optionalLimitedString(request.data.address, "address", 200) ?? null;
  }
  if (request.data?.phone !== undefined) {
    payload.phone = optionalLimitedString(request.data.phone, "phone", 30) ?? null;
  }
  if (typeof request.data?.isActive === "boolean") {
    payload.isActive = request.data.isActive;
  }

  const updateBatch = db.batch();
  updateBatch.set(branchRef, payload, { merge: true });
  updateBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "branch.updated",
      targetType: "branch",
      targetId: branchId,
      before: {
        name: branchSnap.data()?.name ?? null,
        isActive: branchSnap.data()?.isActive ?? null,
      },
      after: {
        name: payload.name ?? branchSnap.data()?.name ?? null,
        isActive: payload.isActive ?? branchSnap.data()?.isActive ?? null,
      },
    }),
  );
  await updateBatch.commit();
  const updated = await branchRef.get();
  const branch = publicBranch(updated as { id: string; data(): DocumentData });
  return {
    ...branch,
    salonId,
    qrUrl: signedQrUrl({
      kind: "branch",
      salonId,
      branchId,
      version: qrVersion(updated.data()?.qrVersion),
    }),
  };
});

export const rotateSalonQr = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);
  const salonRef = db.collection("salons").doc(salonId);
  let version = 1;

  await db.runTransaction(async (tx) => {
    const salonSnap = await tx.get(salonRef);
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
    version = qrVersion(salonSnap.data()?.salonQrVersion) + 1;
    tx.set(salonRef, { salonQrVersion: version, updatedAt: Timestamp.now() }, { merge: true });
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "qr.salon_rotated",
        targetType: "salon",
        targetId: salonId,
        before: { qrVersion: version - 1 },
        after: { qrVersion: version },
      }),
    );
  });

  return { qrUrl: signedQrUrl({ kind: "salon", salonId, version }) };
});

export const rotateBranchQr = onCall(qrFunctionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = requireString(request.data?.branchId, "branchId");
  await assertSalonRole(uid, salonId, ["owner"]);
  const branchRef = db.collection("branches").doc(branchId);
  let version = 1;

  await db.runTransaction(async (tx) => {
    const branchSnap = await tx.get(branchRef);
    if (!branchSnap.exists || branchSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy chi nhánh");
    }
    version = qrVersion(branchSnap.data()?.qrVersion) + 1;
    tx.set(branchRef, { qrVersion: version, updatedAt: Timestamp.now() }, { merge: true });
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "qr.branch_rotated",
        targetType: "branch",
        targetId: branchId,
        before: { qrVersion: version - 1 },
        after: { qrVersion: version },
      }),
    );
  });

  return {
    qrUrl: signedQrUrl({ kind: "branch", salonId, branchId, version }),
  };
});

export const migrateSalonBranches = onCall(
  { ...qrFunctionOptions, timeoutSeconds: 300 },
  async (request) => {
    const uid = currentUid(request.auth);
    const salonId = requireString(request.data?.salonId, "salonId");
    await assertSalonRole(uid, salonId, ["owner"]);
    const salonRef = db.collection("salons").doc(salonId);
    const branchId = defaultBranchIdForSalon(salonId);
    const branchRef = db.collection("branches").doc(branchId);
    let branchName = "Chi nhánh chính";

    await db.runTransaction(async (tx) => {
      const [salonSnap, branchSnap] = await Promise.all([tx.get(salonRef), tx.get(branchRef)]);
      if (!salonSnap.exists) {
        throw new HttpsError("not-found", "Không tìm thấy salon");
      }
      if (!branchSnap.exists) {
        tx.set(branchRef, {
          salonId,
          name: branchName,
          address: salonSnap.data()?.address ?? null,
          phone: salonSnap.data()?.phone ?? null,
          isActive: true,
          qrVersion: 1,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } else {
        branchName = String(branchSnap.data()?.name || branchName);
      }
      tx.set(
        salonRef,
        {
          defaultBranchId: branchId,
          salonQrVersion: qrVersion(salonSnap.data()?.salonQrVersion),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    });

    const counts: Record<string, number> = {};
    counts.mirrors = await backfillSalonCollection("mirrors", salonId, (data) => {
      const patch = legacyBranchPatch({
        currentBranchId: data.branchId,
        defaultBranchId: branchId,
        defaultBranchName: branchName,
      });
      return patch ? { branchId: patch.branchId, updatedAt: Timestamp.now() } : null;
    });
    counts.users = await backfillSalonCollection("users", salonId, (data) => {
      if (data.role !== "staff") {
        return null;
      }
      const branchIds = Array.isArray(data.branchIds) ? data.branchIds : [];
      return branchIds.length > 0
        ? null
        : { branchId, branchIds: [branchId], updatedAt: Timestamp.now() };
    });

    counts.chair_sessions = await backfillOperationalSessions(
      "chair_sessions",
      salonId,
      branchId,
      branchName,
    );
    counts.active_service_sessions = await backfillOperationalSessions(
      "active_service_sessions",
      salonId,
      branchId,
      branchName,
    );
    for (const collectionName of ["point_requests", "haircut_records", "reward_history"]) {
      counts[collectionName] = await backfillSalonCollection(collectionName, salonId, (data) => {
        const patch = legacyBranchPatch({
          currentBranchId: data.branchId,
          defaultBranchId: branchId,
          defaultBranchName: branchName,
        });
        return patch ? { ...patch, updatedAt: Timestamp.now() } : null;
      });
    }
    counts.customers = await backfillSalonCollection("customers", salonId, (data) =>
      data.lastBranchId
        ? null
        : { lastBranchId: branchId, lastBranchName: branchName, updatedAt: Timestamp.now() },
    );
    counts.customerSearch = await migrateCustomerSearchFields(salonId);

    return { branchId, branchName, counts };
  },
);

export const updateStaffProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const staffUid = requireString(request.data?.uid, "uid");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = optionalLimitedString(request.data?.name, "name", 80);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const isActive = typeof request.data?.isActive === "boolean" ? request.data.isActive : undefined;
  const canRedeemRewards =
    typeof request.data?.canRedeemRewards === "boolean" ? request.data.canRedeemRewards : undefined;
  const canAwardPointsDirectly =
    typeof request.data?.canAwardPointsDirectly === "boolean"
      ? request.data.canAwardPointsDirectly
      : undefined;
  const branchIds =
    request.data?.branchIds === undefined
      ? undefined
      : await resolveStaffBranchIds(salonId, request.data.branchIds);
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
  if (canAwardPointsDirectly !== undefined) {
    payload.canAwardPointsDirectly = canAwardPointsDirectly;
  }
  if (branchIds) {
    payload.branchId = branchIds[0];
    payload.branchIds = branchIds;
  }

  if (isActive !== undefined) {
    await getAuth().updateUser(staffUid, { disabled: !isActive });
    if (!isActive) {
      await getAuth().revokeRefreshTokens(staffUid);
    }
  }

  const staffBatch = db.batch();
  staffBatch.set(staffRef, payload, { merge: true });
  staffBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "staff.updated",
      targetType: "user",
      targetId: staffUid,
      before: {
        isActive: staffSnap.data()?.isActive ?? null,
        canRedeemRewards: staffSnap.data()?.canRedeemRewards ?? null,
        canAwardPointsDirectly: staffSnap.data()?.canAwardPointsDirectly ?? null,
        branchIds: staffSnap.data()?.branchIds ?? [],
      },
      after: {
        isActive: isActive ?? staffSnap.data()?.isActive ?? null,
        canRedeemRewards: canRedeemRewards ?? staffSnap.data()?.canRedeemRewards ?? null,
        canAwardPointsDirectly:
          canAwardPointsDirectly ?? staffSnap.data()?.canAwardPointsDirectly ?? null,
        branchIds: branchIds ?? staffSnap.data()?.branchIds ?? [],
      },
    }),
  );
  await staffBatch.commit();

  return { uid: staffUid };
});

export const updateOwnerAvatar = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const avatarUrl = avatarUrlString(request.data?.avatarUrl, salonId, uid);
  const now = Timestamp.now();

  const avatarBatch = db.batch();
  avatarBatch.set(
    db.collection("users").doc(uid),
    {
      avatarUrl: avatarUrl || null,
      updatedAt: now,
    },
    { merge: true },
  );
  avatarBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "owner.avatar_updated",
      targetType: "user",
      targetId: uid,
      after: { hasAvatar: Boolean(avatarUrl) },
      createdAt: now,
    }),
  );
  await avatarBatch.commit();

  await getAuth().updateUser(uid, {
    photoURL: avatarUrl || null,
  });

  return { avatarUrl };
});

export const updateSalonAvatar = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const { salonAvatarUrl, objectName } = salonAvatarUrlString(
    request.data?.salonAvatarUrl,
    salonId,
  );
  const salonRef = db.collection("salons").doc(salonId);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  if (objectName) {
    try {
      const [metadata] = await storage.bucket().file(objectName).getMetadata();
      if (!isValidSalonAvatarMetadata(metadata, { salonId, ownerUid: uid })) {
        throw new HttpsError(
          "invalid-argument",
          "Ảnh đại diện salon không đúng định dạng hoặc thông tin tải lên",
        );
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("invalid-argument", "Không tìm thấy ảnh đại diện vừa tải lên");
    }
  }

  const previousAvatarUrl = trustedStoredSalonAvatarUrl(salonSnap.data()?.avatarUrl, salonId);
  const now = Timestamp.now();
  const avatarBatch = db.batch();
  avatarBatch.set(salonRef, { avatarUrl: salonAvatarUrl || null, updatedAt: now }, { merge: true });
  avatarBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: salonAvatarUrl ? "salon.avatar_updated" : "salon.avatar_removed",
      targetType: "salon",
      targetId: salonId,
      before: { hasAvatar: Boolean(previousAvatarUrl) },
      after: { hasAvatar: Boolean(salonAvatarUrl) },
      createdAt: now,
    }),
  );
  await avatarBatch.commit();

  if (!salonAvatarUrl && previousAvatarUrl) {
    try {
      await storage.bucket().file(salonAvatarObjectPath(salonId)).delete({ ignoreNotFound: true });
    } catch {
      console.warn("Không xóa được object ảnh đại diện salon sau khi gỡ liên kết");
    }
  }

  return { salonAvatarUrl };
});

export const getSalonProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner", "staff"]);

  const [salonSnap, features] = await Promise.all([
    db.collection("salons").doc(salonId).get(),
    getSystemFeatures(salonId),
  ]);
  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  const salon = salonSnap.data();
  return {
    id: salonSnap.id,
    name: salon?.name ?? "Salon",
    address: salon?.address ?? "",
    phone: salon?.phone ?? "",
    avatarUrl: trustedStoredSalonAvatarUrl(salon?.avatarUrl, salonId),
    pointPerVisit: Number(salon?.pointPerVisit ?? 1),
    freeCustomerLimit: Number(salon?.freeCustomerLimit ?? 50),
    features,
  };
});

export const updateSalonProfile = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);

  const name = limitedString(request.data?.name, "name", 120);
  const address = optionalLimitedString(request.data?.address, "address", 200);
  const phone = optionalLimitedString(request.data?.phone, "phone", 30);
  const pointPerVisit = requireBoundedPositiveNumber(
    request.data?.pointPerVisit,
    "pointPerVisit",
    100,
  );
  const salonRef = db.collection("salons").doc(salonId);
  const salonSnap = await salonRef.get();

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Không tìm thấy salon");
  }

  const now = Timestamp.now();
  const salonBatch = db.batch();
  salonBatch.set(
    salonRef,
    {
      name,
      address: address ?? null,
      phone: phone ?? null,
      pointPerVisit,
      updatedAt: now,
    },
    { merge: true },
  );
  salonBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "salon.profile_updated",
      targetType: "salon",
      targetId: salonId,
      before: {
        name: salonSnap.data()?.name ?? null,
        pointPerVisit: salonSnap.data()?.pointPerVisit ?? null,
      },
      after: { name, pointPerVisit },
      createdAt: now,
    }),
  );
  await salonBatch.commit();
  const features = await getSystemFeatures(salonId);

  return {
    id: salonId,
    name,
    address: address ?? "",
    phone: phone ?? "",
    pointPerVisit,
    freeCustomerLimit: Number(salonSnap.data()?.freeCustomerLimit ?? 50),
    features,
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
        canAwardPointsDirectly: Boolean(data.canAwardPointsDirectly),
        branchId: String(data.branchId || ""),
        branchIds: Array.isArray(data.branchIds)
          ? data.branchIds.filter((value): value is string => typeof value === "string")
          : data.branchId
            ? [String(data.branchId)]
            : [],
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
  const salonRef = db.collection("salons").doc(salonId);
  await ensureSalonCustomerCount(salonId);
  await db.runTransaction(async (tx) => {
    const [snap, salonSnap] = await Promise.all([tx.get(customerRef), tx.get(salonRef)]);
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
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
    };

    if (snap.exists) {
      tx.set(customerRef, payload, { merge: true });
    } else {
      const customerCount = assertCustomerQuota(salonSnap.data() ?? {});
      tx.set(customerRef, {
        ...payload,
        points: 0,
        createdAt: now,
      });
      tx.set(salonRef, { customerCount: customerCount + 1, updatedAt: now }, { merge: true });
    }
  });

  return { customerId };
});

export const resolveCustomerQr = onCall(qrFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  await enforcePublicRequestPolicy("resolveCustomerQr", request, salonId, request.data?.qrToken);
  return resolveCustomerQrData(request.data);
});

export const registerCustomerFromZalo = onCall(zaloQrFunctionOptions, async (request) => {
  const verificationRequestId = createZaloVerificationRequestId();
  const salonId = requireString(request.data?.salonId, "salonId");
  await enforcePublicRequestPolicy(
    "registerCustomerFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  await assertFeatureEnabled(
    salonId,
    "checkinEnabled",
    "Salon đang tạm ngừng nhận lượt check-in mới.",
    request.data?.appVersion,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken, {
    requestId: verificationRequestId,
    functionName: "registerCustomerFromZalo",
  });
  const zaloUserId = zaloProfile.zaloUserId;
  const name =
    optionalLimitedString(request.data?.name, "name", 80) ??
    String(zaloProfile.name ?? "Khách hàng").slice(0, 80);
  const suppliedPhone = optionalLimitedString(request.data?.phone, "phone", 30);
  const phoneToken = optionalLimitedString(request.data?.phoneToken, "phoneToken", 2048);
  let phone = suppliedPhone;

  if (phoneToken) {
    const accessToken = requireString(request.data?.zaloAccessToken, "zaloAccessToken");
    const appSecret =
      zaloAppSecret.value() || process.env.ZALO_APP_SECRET || process.env.ZALO_SECRET_KEY || "";

    if (!appSecret || appSecret.includes("your-")) {
      throw new HttpsError(
        "failed-precondition",
        "Máy chủ chưa được cấu hình để nhận số điện thoại từ Zalo",
      );
    }

    try {
      phone = await decodeZaloPhoneNumber(accessToken, phoneToken, appSecret, {
        endpoint: process.env.ZALO_PHONE_ENDPOINT,
      });
    } catch {
      throw new HttpsError(
        "failed-precondition",
        "Không lấy được số điện thoại từ Zalo. Vui lòng bấm xác nhận lại.",
      );
    }
  }
  const birthday = optionalLimitedString(request.data?.birthday, "birthday", 20);
  const contactPatch = buildCustomerContactPatch({
    phone,
    birthday,
    clearPhone: request.data?.clearPhone === true,
    clearBirthday: request.data?.clearBirthday === true,
  });
  const allowPhoto = requireBoolean(request.data?.allowPhoto, "allowPhoto");
  const qrResolution = await resolveCustomerQrData(request.data);
  if (qrResolution.selectionRequired) {
    throw new HttpsError("failed-precondition", "Vui lòng chọn chi nhánh trước khi tạo lượt");
  }
  if (!qrResolution.branchId) {
    throw new HttpsError("failed-precondition", "Salon chưa có chi nhánh đang hoạt động");
  }
  const branchId = qrResolution.branchId;

  const customerId = customerIdFor(salonId, zaloUserId);
  const customerRef = db.collection("customers").doc(customerId);
  const salonRef = db.collection("salons").doc(salonId);
  const sessionRef = db.collection("chair_sessions").doc();
  const activeSessionRef = activeSessionRefFor(salonId, customerId);
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    serviceSessionExpiresAtMs(now.toMillis(), SESSION_POINT_REQUEST_WINDOW_MS),
  );
  let returnedSessionId = sessionRef.id;
  let returnedBranchId = branchId;
  let returnedBranchName = qrResolution.branchName;
  let returnedBranchAddress = qrResolution.branchAddress;
  let returnedStatus = "waiting";

  await ensureSalonCustomerCount(salonId);
  await db.runTransaction(async (tx) => {
    const [customerSnap, activeSessionSnap, salonSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(activeSessionRef),
      tx.get(salonRef),
    ]);
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
    const activeSession = activeSessionSnap.exists ? activeSessionSnap.data() : null;
    let reuseExistingSession = Boolean(
      activeSession &&
      shouldReuseActiveSession({
        status: activeSession.status,
        sessionId: activeSession.sessionId,
        createdAtMs: timestampMillis(activeSession.createdAt),
        expiresAtMs: timestampMillis(activeSession.expiresAt),
        nowMs: now.toMillis(),
        maxAgeMs: SESSION_POINT_REQUEST_WINDOW_MS,
      }),
    );
    const previousSessionId =
      activeSession && typeof activeSession.sessionId === "string" ? activeSession.sessionId : "";
    const previousSessionRef = previousSessionId
      ? db.collection("chair_sessions").doc(previousSessionId)
      : null;
    const previousSessionSnap = previousSessionRef ? await tx.get(previousSessionRef) : null;

    if (
      reuseExistingSession &&
      (!previousSessionSnap?.exists ||
        previousSessionSnap.data()?.salonId !== salonId ||
        previousSessionSnap.data()?.customerId !== customerId)
    ) {
      reuseExistingSession = false;
    }

    if (reuseExistingSession && activeSession) {
      returnedSessionId = String(activeSession.sessionId);
      returnedBranchId = String(activeSession.branchId || branchId);
      returnedBranchName = String(activeSession.branchName || qrResolution.branchName);
      returnedBranchAddress = String(activeSession.branchAddress || qrResolution.branchAddress);
      const activeStatus = String(activeSession.status ?? "");
      returnedStatus =
        activeStatus === "serving" && !activeSession.assignedStaffId
          ? "pending_approval"
          : activeStatus;
    }

    const existingCustomer = customerSnap.exists ? customerSnap.data() : {};
    const customerSummary = {
      name,
      phoneLast4:
        contactPatch.phoneLast4 !== undefined
          ? (contactPatch.phoneLast4 ?? "")
          : String(existingCustomer?.phoneLast4 || ""),
      points: Math.max(0, Number(existingCustomer?.points ?? 0)),
      allowPhoto,
    };

    const baseCustomer = {
      salonId,
      zaloUserId,
      name,
      nameSearch: normalizeSearchText(name),
      namePrefixes: buildNameSearchPrefixes(name),
      ...contactPatch,
      allowPhoto,
      lastBranchId: returnedBranchId,
      lastBranchName: returnedBranchName,
      updatedAt: now,
    };

    if (customerSnap.exists) {
      tx.set(customerRef, baseCustomer, { merge: true });
    } else {
      const customerCount = assertCustomerQuota(salonSnap.data() ?? {});
      tx.set(customerRef, {
        phone: null,
        phoneLast4: null,
        birthday: null,
        ...baseCustomer,
        points: 0,
        createdAt: now,
      });
      tx.set(salonRef, { customerCount: customerCount + 1, updatedAt: now }, { merge: true });
    }

    if (reuseExistingSession && previousSessionRef) {
      tx.set(activeSessionRef, { updatedAt: now }, { merge: true });
      tx.set(
        previousSessionRef,
        {
          customerSummary,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    if (
      previousSessionRef &&
      previousSessionSnap?.exists &&
      OPEN_SESSION_STATUSES.includes(
        String(previousSessionSnap.data()?.status) as (typeof OPEN_SESSION_STATUSES)[number],
      )
    ) {
      tx.set(
        previousSessionRef,
        {
          status: "cancelled",
          isOpen: false,
          cancellationReason: "expired",
          cancelledAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    tx.set(sessionRef, {
      salonId,
      branchId,
      branchName: qrResolution.branchName,
      branchAddress: qrResolution.branchAddress,
      qrType: qrResolution.qrType,
      legacyMirrorId: qrResolution.legacyMirrorId ?? null,
      mirrorId: qrResolution.legacyMirrorId ?? null,
      mirrorName: qrResolution.branchName,
      customerId,
      customerSummary,
      status: "waiting",
      isOpen: true,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(activeSessionRef, {
      salonId,
      customerId,
      sessionId: sessionRef.id,
      branchId,
      branchName: qrResolution.branchName,
      branchAddress: qrResolution.branchAddress,
      qrType: qrResolution.qrType,
      legacyMirrorId: qrResolution.legacyMirrorId ?? null,
      status: "waiting",
      isOpen: true,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  });

  const customerSnap = await customerRef.get();
  return {
    customerId,
    sessionId: returnedSessionId,
    branchId: returnedBranchId,
    branchName: returnedBranchName,
    branchAddress: returnedBranchAddress,
    sessionStatus: returnedStatus,
    points: customerSnap.data()?.points ?? 0,
    zaloUserId,
    phoneLast4: String(customerSnap.data()?.phoneLast4 || ""),
    features: qrResolution.features,
  };
});

type PhotoUploadContext = {
  user: AppUser;
  salonId: string;
  branchId: string;
  customerId: string;
  sessionId: string;
  sessionStatus: string;
};

async function loadPhotoUploadContext(input: {
  uid: string;
  salonId: string;
  sessionId: string;
}): Promise<PhotoUploadContext> {
  const user = await assertSalonRole(input.uid, input.salonId, ["owner", "staff"]);
  const sessionSnap = await db.collection("chair_sessions").doc(input.sessionId).get();
  const session = sessionSnap.data();
  if (!sessionSnap.exists || session?.salonId !== input.salonId) {
    throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
  }
  const branchId = String(session.branchId || "");
  const customerId = String(session.customerId || "");
  if (!branchId || !customerId) {
    throw new HttpsError(
      "failed-precondition",
      "Phiên phục vụ thiếu thông tin chi nhánh hoặc khách",
    );
  }
  await assertBranchAccess(user, branchId);
  const [branchSnap, customerSnap] = await Promise.all([
    db.collection("branches").doc(branchId).get(),
    db.collection("customers").doc(customerId).get(),
  ]);
  assertBranchIsOperational(branchSnap.data(), input.salonId, branchId);
  if (
    !customerSnap.exists ||
    customerSnap.data()?.salonId !== input.salonId ||
    customerSnap.data()?.allowPhoto !== true
  ) {
    throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
  }
  const staffOwnsServingSession =
    session.status === "serving" && session.assignedStaffId === input.uid;
  const ownerCanEditPendingSession = user.role === "owner" && session.status === "pending_approval";
  if (!staffOwnsServingSession && !ownerCanEditPendingSession) {
    throw new HttpsError("permission-denied", "Bạn không phụ trách ảnh của lượt cắt này");
  }
  return {
    user,
    salonId: input.salonId,
    branchId,
    customerId,
    sessionId: input.sessionId,
    sessionStatus: String(session.status || ""),
  };
}

export const beginHaircutPhotoUpload = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const requestId = requireString(request.data?.requestId, "requestId");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "Mã yêu cầu tải ảnh không hợp lệ");
  }
  const expectedContentType = requireString(
    request.data?.expectedContentType,
    "expectedContentType",
  );
  const expectedBytes = Math.floor(Number(request.data?.expectedBytes ?? 0));
  const checksum = optionalLimitedString(request.data?.checksum, "checksum", 128) ?? "";
  if (
    expectedContentType !== "image/jpeg" ||
    expectedBytes <= 0 ||
    expectedBytes > PHOTO_UPLOAD_MAX_BYTES ||
    !/^[a-f0-9]{64}$/.test(checksum)
  ) {
    throw new HttpsError("invalid-argument", "Ảnh phải là JPEG hợp lệ và không vượt quá 3MB");
  }
  await enforceAuthenticatedRateLimit("beginHaircutPhotoUpload", uid, salonId);
  await assertFeatureEnabled(
    salonId,
    "photoUploadEnabled",
    "Tính năng lưu ảnh kiểu tóc đang tạm ngừng.",
    request.data?.appVersion,
  );
  const context = await loadPhotoUploadContext({ uid, salonId, sessionId });
  const operationId = buildPhotoUploadOperationId(salonId, sessionId, uid, requestId);
  const operationRef = db.collection("photo_upload_operations").doc(operationId);
  const storagePath = buildPhotoUploadStoragePath({
    salonId,
    customerId: context.customerId,
    sessionId,
    operationId,
  });
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + PHOTO_UPLOAD_OPERATION_TTL_MS);
  let returnedExpiresAtMs = expiresAt.toMillis();
  let status = "pending";

  await db.runTransaction(async (tx) => {
    const [operationSnap, sessionSnap, customerSnap] = await Promise.all([
      tx.get(operationRef),
      tx.get(db.collection("chair_sessions").doc(sessionId)),
      tx.get(db.collection("customers").doc(context.customerId)),
    ]);
    const operation = operationSnap.data();
    if (operationSnap.exists) {
      if (
        operation?.salonId !== salonId ||
        operation?.sessionId !== sessionId ||
        operation?.staffUid !== uid ||
        operation?.requestId !== requestId ||
        operation?.storagePath !== storagePath
      ) {
        throw new HttpsError("already-exists", "Mã yêu cầu tải ảnh đã được dùng");
      }
      if (
        ["cancelled", "expired", "failed"].includes(String(operation.status)) ||
        isPhotoUploadOperationExpired(timestampMillis(operation.expiresAt) ?? 0, now.toMillis())
      ) {
        throw new HttpsError("failed-precondition", "Yêu cầu tải ảnh đã hết hiệu lực");
      }
      status = String(operation.status || "pending");
      returnedExpiresAtMs = timestampMillis(operation.expiresAt) ?? expiresAt.toMillis();
      return;
    }
    const session = sessionSnap.data();
    const customer = customerSnap.data();
    const accessStillValid =
      sessionSnap.exists &&
      session?.salonId === salonId &&
      session?.branchId === context.branchId &&
      session?.customerId === context.customerId &&
      ((session?.status === "serving" && session?.assignedStaffId === uid) ||
        (context.user.role === "owner" && session?.status === "pending_approval"));
    if (!accessStillValid) {
      throw new HttpsError("failed-precondition", "Phiên phục vụ đã thay đổi, vui lòng tải lại");
    }
    if (!customerSnap.exists || customer?.salonId !== salonId || customer?.allowPhoto !== true) {
      throw new HttpsError("failed-precondition", "Khách đã thu hồi đồng ý lưu ảnh");
    }
    tx.create(operationRef, {
      operationId,
      requestId,
      salonId,
      branchId: context.branchId,
      customerId: context.customerId,
      sessionId,
      staffUid: uid,
      storagePath,
      status: "pending",
      expectedContentType,
      expectedMaxBytes: PHOTO_UPLOAD_MAX_BYTES,
      expectedBytes,
      checksum,
      consentVersion:
        timestampMillis(customer.consentUpdatedAt) ?? timestampMillis(customer.updatedAt) ?? 1,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      finalizedAt: null,
      failureCode: null,
    });
    tx.create(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId: context.branchId,
        actorId: uid,
        actorRole: context.user.role,
        action: "photo.upload_started",
        targetType: "photo_upload_operation",
        targetId: operationId,
        requestId,
        metadata: { sessionId, expectedBytes },
        createdAt: now,
      }),
    );
  });

  return {
    operationId,
    requestId,
    storagePath,
    status,
    expectedMaxBytes: PHOTO_UPLOAD_MAX_BYTES,
    expiresAtMs: returnedExpiresAtMs,
  };
});

export const finalizeHaircutPhotoUpload = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const operationId = requireString(request.data?.operationId, "operationId");
  await enforceAuthenticatedRateLimit("finalizeHaircutPhotoUpload", uid, salonId);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const operationRef = db.collection("photo_upload_operations").doc(operationId);
  const operationSnap = await operationRef.get();
  const operation = operationSnap.data();
  if (!operationSnap.exists || operation?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy yêu cầu tải ảnh");
  }
  if (operation.staffUid !== uid) {
    throw new HttpsError("permission-denied", "Yêu cầu tải ảnh không thuộc tài khoản này");
  }
  if (operation.status === "finalized") {
    return {
      operationId,
      requestId: operation.requestId,
      storagePath: operation.storagePath,
      status: "finalized",
      alreadyFinalized: true,
    };
  }
  if (
    ["cancelled", "expired", "failed"].includes(String(operation.status)) ||
    isPhotoUploadOperationExpired(timestampMillis(operation.expiresAt) ?? 0)
  ) {
    throw new HttpsError("failed-precondition", "Yêu cầu tải ảnh đã hết hiệu lực");
  }
  let context: PhotoUploadContext;
  try {
    context = await loadPhotoUploadContext({
      uid,
      salonId,
      sessionId: String(operation.sessionId || ""),
    });
  } catch (error) {
    await operationRef.set(
      {
        status: "failed",
        cleanupStatus: "pending",
        failureCode: "CONSENT_OR_SESSION_CHANGED",
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    throw error;
  }
  if (
    context.branchId !== operation.branchId ||
    context.customerId !== operation.customerId ||
    !isExpectedPhotoUploadPath(String(operation.storagePath || ""), {
      salonId,
      customerId: context.customerId,
      sessionId: context.sessionId,
      operationId,
    })
  ) {
    throw new HttpsError("permission-denied", "Thông tin tải ảnh không còn hợp lệ");
  }

  let metadata;
  let photoBytes: Buffer;
  try {
    const file = storage.bucket().file(String(operation.storagePath));
    [[metadata], [photoBytes]] = await Promise.all([file.getMetadata(), file.download()]);
  } catch {
    throw new HttpsError("failed-precondition", "Ảnh chưa được tải lên hoàn tất");
  }
  if (
    !validatePhotoUploadObject(metadata, {
      salonId,
      branchId: context.branchId,
      customerId: context.customerId,
      sessionId: context.sessionId,
      staffUid: uid,
      operationId,
      requestId: String(operation.requestId || ""),
    }) ||
    Number(metadata.size ?? 0) !== Number(operation.expectedBytes ?? 0) ||
    String(metadata.metadata?.checksum || "") !== String(operation.checksum || "") ||
    !validatePhotoUploadBytes(photoBytes, String(operation.checksum || ""))
  ) {
    await operationRef.set(
      {
        status: "failed",
        cleanupStatus: "pending",
        failureCode: "INVALID_IMAGE_CONTENT",
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    throw new HttpsError("invalid-argument", "Ảnh tải lên không có metadata hợp lệ");
  }
  const now = Timestamp.now();
  let alreadyFinalized = false;
  let finalizationFailure = false;
  await db.runTransaction(async (tx) => {
    const [currentOperationSnap, sessionSnap, customerSnap] = await Promise.all([
      tx.get(operationRef),
      tx.get(db.collection("chair_sessions").doc(context.sessionId)),
      tx.get(db.collection("customers").doc(context.customerId)),
    ]);
    const current = currentOperationSnap.data();
    if (current?.status === "finalized") {
      alreadyFinalized = true;
      return;
    }
    if (
      !currentOperationSnap.exists ||
      current?.salonId !== salonId ||
      current?.staffUid !== uid ||
      current?.storagePath !== operation.storagePath ||
      !["pending", "uploading", "uploaded"].includes(String(current?.status || "")) ||
      isPhotoUploadOperationExpired(timestampMillis(current?.expiresAt) ?? 0, now.toMillis())
    ) {
      throw new HttpsError("failed-precondition", "Yêu cầu tải ảnh không còn hợp lệ");
    }
    const session = sessionSnap.data();
    const customer = customerSnap.data();
    const sessionAllowed =
      sessionSnap.exists &&
      session?.salonId === salonId &&
      session?.branchId === context.branchId &&
      session?.customerId === context.customerId &&
      ((session?.status === "serving" && session?.assignedStaffId === uid) ||
        (user.role === "owner" && session?.status === "pending_approval"));
    if (!sessionAllowed || !customerSnap.exists || customer?.allowPhoto !== true) {
      finalizationFailure = true;
      tx.set(
        operationRef,
        {
          status: "failed",
          cleanupStatus: "pending",
          failureCode: "CONSENT_OR_SESSION_CHANGED",
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }
    tx.set(
      operationRef,
      {
        status: "finalized",
        actualBytes: Number(metadata.size ?? 0),
        actualContentType: metadata.contentType,
        finalizedAt: now,
        attachmentStatus: "unattached",
        orphanExpiresAt: Timestamp.fromMillis(now.toMillis() + PHOTO_UPLOAD_ORPHAN_TTL_MS),
        updatedAt: now,
        failureCode: null,
      },
      { merge: true },
    );
    tx.create(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId: context.branchId,
        actorId: uid,
        actorRole: user.role,
        action: "photo.upload_completed",
        targetType: "photo_upload_operation",
        targetId: operationId,
        requestId: String(operation.requestId || ""),
        metadata: { sessionId: context.sessionId, size: Number(metadata.size ?? 0) },
        createdAt: now,
      }),
    );
  });

  if (finalizationFailure) {
    throw new HttpsError("failed-precondition", "Đồng ý lưu ảnh hoặc phiên phục vụ đã thay đổi");
  }

  return {
    operationId,
    requestId: operation.requestId,
    storagePath: operation.storagePath,
    status: "finalized",
    alreadyFinalized,
  };
});

export const getRecoverableHaircutPhotoUploads = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  await enforceAuthenticatedRateLimit("getRecoverableHaircutPhotoUploads", uid, salonId);
  const context = await loadPhotoUploadContext({ uid, salonId, sessionId });
  const operationQuery = db
    .collection("photo_upload_operations")
    .where("salonId", "==", salonId)
    .where("sessionId", "==", sessionId)
    .where("staffUid", "==", uid);
  const [finalizedSnapshot, inProgressSnapshot] = await Promise.all([
    operationQuery
      .where("status", "==", "finalized")
      .where("attachmentStatus", "==", "unattached")
      .limit(MAX_HAIRCUT_PHOTOS)
      .get(),
    operationQuery
      .where("status", "in", ["pending", "uploading", "uploaded"])
      .limit(MAX_HAIRCUT_PHOTOS)
      .get(),
  ]);
  const photos = [...finalizedSnapshot.docs, ...inProgressSnapshot.docs]
    .slice(0, MAX_HAIRCUT_PHOTOS)
    .flatMap((operationSnap) => {
      const operation = operationSnap.data();
      const storagePath = String(operation.storagePath || "");
      if (
        operation.branchId !== context.branchId ||
        operation.customerId !== context.customerId ||
        !isExpectedPhotoUploadPath(storagePath, {
          salonId,
          customerId: context.customerId,
          sessionId,
          operationId: operationSnap.id,
        })
      ) {
        return [];
      }
      return [
        {
          id: operationSnap.id,
          operationId: operationSnap.id,
          requestId: String(operation.requestId || ""),
          path: storagePath,
          status: String(operation.status || "pending"),
        },
      ];
    });
  return { photos };
});

export const cancelHaircutPhotoUpload = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const operationId = requireString(request.data?.operationId, "operationId");
  await enforceAuthenticatedRateLimit("cancelHaircutPhotoUpload", uid, salonId);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const operationRef = db.collection("photo_upload_operations").doc(operationId);
  const operationSnap = await operationRef.get();
  const operation = operationSnap.data();
  if (!operationSnap.exists || operation?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy yêu cầu tải ảnh");
  }
  if (operation.staffUid !== uid) {
    throw new HttpsError("permission-denied", "Yêu cầu tải ảnh không thuộc tài khoản này");
  }
  if (operation.status === "cancelled") {
    return { operationId, status: "cancelled", alreadyCancelled: true };
  }
  if (operation.attachmentStatus === "attached") {
    throw new HttpsError(
      "failed-precondition",
      "Ảnh đã được gắn vào lượt cắt và phải được gỡ khỏi yêu cầu trước khi xóa",
    );
  }
  await db.runTransaction(async (tx) => {
    const currentSnap = await tx.get(operationRef);
    const current = currentSnap.data();
    if (current?.status === "cancelled") return;
    if (current?.attachmentStatus === "attached") {
      throw new HttpsError(
        "failed-precondition",
        "Ảnh đã được gắn vào lượt cắt và không thể hủy trực tiếp",
      );
    }
    tx.set(
      operationRef,
      { status: "cancelled", cancelledAt: Timestamp.now(), updatedAt: Timestamp.now() },
      { merge: true },
    );
    tx.create(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId: String(operation.branchId || ""),
        actorId: uid,
        actorRole: user.role,
        action: "photo.upload_cancelled",
        targetType: "photo_upload_operation",
        targetId: operationId,
        requestId: String(operation.requestId || ""),
      }),
    );
  });
  try {
    await storage
      .bucket()
      .file(String(operation.storagePath || ""))
      .delete({ ignoreNotFound: true });
  } catch {
    await operationRef.set(
      {
        cleanupStatus: "pending",
        cleanupFailureCode: "STORAGE_DELETE_FAILED",
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  }
  return { operationId, status: "cancelled", alreadyCancelled: false };
});

export const submitPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const note = optionalLimitedString(request.data?.note, "note", 500) ?? "";
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await enforceAuthenticatedRateLimit("submitPointRequest", uid, salonId);
  await assertFeatureEnabled(
    salonId,
    "pointApprovalEnabled",
    "Tính năng gửi và duyệt điểm đang tạm ngừng.",
    request.data?.appVersion,
  );
  const staffName = user.name || "Nhân viên";
  const salonSnap = await db.collection("salons").doc(salonId).get();
  const pointPerVisit = Math.max(1, Math.floor(Number(salonSnap.data()?.pointPerVisit ?? 1)));
  const pointsRequested = pointPerVisit;
  const photoUrls = safePhotoUrls(request.data?.photoUrls);
  const photoPaths = safePhotoPaths(request.data?.photoPaths);
  const now = Timestamp.now();
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const requestRef = db.collection("point_requests").doc(sessionId);
  const submittedRequestSnap = await requestRef.get();
  if (submittedRequestSnap.exists) {
    const submittedRequest = submittedRequestSnap.data();
    if (
      submittedRequest?.salonId === salonId &&
      submittedRequest?.sessionId === sessionId &&
      submittedRequest?.staffId === uid
    ) {
      return {
        requestId: requestRef.id,
        alreadySubmitted: true,
        status: submittedRequest?.status === "approved" ? "approved" : "pending_approval",
        approvalMode: submittedRequest?.approvalMode ?? "owner_approval",
        pointsAdded: Number(submittedRequest?.pointsAdded ?? pointsRequested),
        pointsAfter:
          submittedRequest?.status === "approved"
            ? Number(submittedRequest?.pointsAfter ?? 0)
            : undefined,
      };
    }
    throw apiError(
      "already-exists",
      ApiErrorCode.REQUEST_ALREADY_PROCESSED,
      "Lượt cắt đã có yêu cầu điểm khác",
    );
  }
  let alreadySubmitted = false;
  let resultStatus: "approved" | "pending_approval" = "pending_approval";
  let approvalMode: "staff_direct" | "owner_direct" | "owner_approval" = "owner_approval";
  let resultPointsAfter: number | undefined;
  const directAwardDateKey = bangkokDateKey(now.toMillis());
  const directAwardCounterRef = db
    .collection("staff_daily_point_awards")
    .doc(createHash("sha256").update(`${salonId}:${uid}:${directAwardDateKey}`).digest("hex"));

  if (photoUrls.length > 0 || photoPaths.length > 0) {
    await assertFeatureEnabled(
      salonId,
      "photoUploadEnabled",
      "Tính năng lưu ảnh kiểu tóc đang tạm ngừng.",
      request.data?.appVersion,
    );
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data();
    if (!sessionSnap.exists || session?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
    }
    const branchId = String(session.branchId || "");
    if (!branchId) {
      throw new HttpsError("failed-precondition", "Lượt cắt chưa được gắn chi nhánh");
    }
    await assertBranchAccess(user, branchId);
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
      branchId,
      customerId,
      sessionId,
      uploaderUid: uid,
    });
    await assertFinalizedPhotoUploadPaths({
      photoPaths,
      salonId,
      branchId,
      customerId,
      sessionId,
      uploaderUid: uid,
    });
  }

  await db.runTransaction(async (tx) => {
    const [sessionSnap, existingRequestSnap, directAwardCounterSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(requestRef),
      tx.get(directAwardCounterRef),
    ]);
    const operationSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    for (const photoPath of photoPaths) {
      const operationId = operationIdFromPhotoPath(photoPath);
      if (!operationId) {
        throw new HttpsError("invalid-argument", "Đường dẫn ảnh không hợp lệ");
      }
      operationSnaps.push(await tx.get(db.collection("photo_upload_operations").doc(operationId)));
    }

    if (existingRequestSnap.exists) {
      const existingRequest = existingRequestSnap.data();
      if (
        existingRequest?.salonId === salonId &&
        existingRequest?.sessionId === sessionId &&
        existingRequest?.staffId === uid
      ) {
        alreadySubmitted = true;
        resultStatus = existingRequest?.status === "approved" ? "approved" : "pending_approval";
        approvalMode = existingRequest?.approvalMode ?? "owner_approval";
        resultPointsAfter =
          existingRequest?.status === "approved"
            ? Number(existingRequest?.pointsAfter ?? 0)
            : undefined;
        return;
      }
      throw apiError(
        "already-exists",
        ApiErrorCode.REQUEST_ALREADY_PROCESSED,
        "Lượt cắt đã có yêu cầu điểm khác",
      );
    }

    if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy phiên phục vụ");
    }

    const session = sessionSnap.data();
    const branchId = String(session?.branchId || "");
    if (!branchId) {
      throw new HttpsError("failed-precondition", "Lượt cắt chưa được gắn chi nhánh");
    }
    await assertBranchAccess(user, branchId);
    const branchSnap = await tx.get(db.collection("branches").doc(branchId));
    assertBranchIsOperational(branchSnap.data(), salonId, branchId);
    if (session?.status !== "serving") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.SESSION_NOT_OPEN,
        session?.status === "waiting"
          ? "Nhân viên cần nhận khách trước khi gửi yêu cầu điểm"
          : "Phiên này đã được gửi yêu cầu điểm hoặc đã xử lý",
      );
    }
    if (session.assignedStaffId !== uid) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.SESSION_ALREADY_CLAIMED,
        `Lượt này đang do ${String(session.assignedStaffName || "nhân viên khác")} phụ trách`,
      );
    }
    if (!isFreshServiceSession(session.createdAt, now, session.expiresAt)) {
      throw new HttpsError("failed-precondition", "Phiên cắt đã quá thời gian cho phép cộng điểm");
    }
    if (existingRequestSnap.exists) {
      throw apiError(
        "already-exists",
        ApiErrorCode.REQUEST_ALREADY_PROCESSED,
        "Phiên này đã có yêu cầu cộng điểm",
      );
    }

    const customerRef = db.collection("customers").doc(String(session.customerId || ""));
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
      throw new HttpsError("failed-precondition", "Hồ sơ khách không thuộc salon này");
    }
    if (
      (photoUrls.length > 0 || photoPaths.length > 0) &&
      customerSnap.data()?.allowPhoto !== true
    ) {
      throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
    }
    const customer = customerSnap.data() ?? {};

    for (const operationSnap of operationSnaps) {
      const operation = operationSnap.data();
      if (
        !operationSnap.exists ||
        operation?.status !== "finalized" ||
        operation?.salonId !== salonId ||
        operation?.branchId !== branchId ||
        operation?.customerId !== session.customerId ||
        operation?.sessionId !== sessionId ||
        operation?.staffUid !== uid
      ) {
        throw new HttpsError("failed-precondition", "Ảnh tải lên không còn hợp lệ");
      }
    }

    const directAwardsToday = Math.max(0, Number(directAwardCounterSnap.data()?.awards ?? 0));
    const decision = directPointAwardDecision({
      role: user.role,
      canAwardPointsDirectly: user.canAwardPointsDirectly === true,
      pointsRequested,
      pointPerVisit,
      directAwardsToday,
      dailyAwardLimit: DIRECT_POINT_AWARD_DAILY_LIMIT,
    });
    const autoApprove = decision === "auto_approve";
    approvalMode = autoApprove
      ? user.role === "owner"
        ? "owner_direct"
        : "staff_direct"
      : "owner_approval";
    resultStatus = autoApprove ? "approved" : "pending_approval";
    const pointsBefore = Math.max(0, Number(customer.points ?? 0));
    const pointsAfter = pointsBefore + pointsRequested;
    resultPointsAfter = autoApprove ? pointsAfter : undefined;
    const canKeepPhotos = customer.allowPhoto === true;
    const recordPhotoUrls = canKeepPhotos
      ? trustedStoredHaircutPhotoUrls(photoUrls, {
          salonId,
          customerId: String(session.customerId || ""),
          sessionId,
        })
      : [];
    const recordPhotoPaths = canKeepPhotos
      ? trustedStoredHaircutPhotoPaths(photoPaths, {
          salonId,
          customerId: String(session.customerId || ""),
          sessionId,
        })
      : [];

    tx.set(requestRef, {
      salonId,
      branchId,
      branchName: session.branchName ?? "",
      sessionId,
      customerId: session.customerId,
      staffId: uid,
      staffName,
      note,
      photoUrls: autoApprove ? recordPhotoUrls : photoUrls,
      photoPaths: autoApprove ? recordPhotoPaths : photoPaths,
      pointsRequested,
      pointsAdded: pointsRequested,
      customerSummary: {
        name: String(customer.name || "Khách hàng"),
        phoneLast4: String(customer.phoneLast4 || ""),
        points: Math.max(0, Number(customer.points ?? 0)),
        allowPhoto: Boolean(customer.allowPhoto),
      },
      status: autoApprove ? "approved" : "pending",
      approvalMode,
      idempotencyKey: sessionId,
      approvedBy: autoApprove ? uid : null,
      approvedAt: autoApprove ? now : null,
      processedAt: autoApprove ? now : null,
      processedBy: autoApprove ? uid : null,
      pointsBefore: autoApprove ? pointsBefore : null,
      pointsAfter: autoApprove ? pointsAfter : null,
      createdAt: now,
      updatedAt: now,
    });

    if (autoApprove) {
      const recordId = createHash("sha256").update(`haircut-record:${sessionId}`).digest("hex");
      tx.update(customerRef, {
        points: pointsAfter,
        lastVisitAt: now,
        updatedAt: now,
      });
      tx.set(db.collection("haircut_records").doc(recordId), {
        salonId,
        branchId,
        branchName: session.branchName ?? "",
        customerId: session.customerId,
        staffId: uid,
        staffName,
        pointRequestId: sessionId,
        note,
        photoUrls: recordPhotoUrls,
        photoPaths: recordPhotoPaths,
        pointsAdded: pointsRequested,
        approvedBy: uid,
        approvalMode,
        createdAt: now,
      });
      tx.set(
        sessionRef,
        { status: "completed", isOpen: false, completedAt: now, updatedAt: now },
        { merge: true },
      );
      tx.delete(activeSessionRefFor(salonId, String(session.customerId || "")));
      if (user.role === "staff") {
        tx.set(
          directAwardCounterRef,
          {
            salonId,
            staffId: uid,
            dateKey: directAwardDateKey,
            awards: directAwardsToday + 1,
            pointsAwarded:
              Math.max(0, Number(directAwardCounterSnap.data()?.pointsAwarded ?? 0)) +
              pointsRequested,
            updatedAt: now,
          },
          { merge: true },
        );
      }
      tx.set(
        db.collection("audit_events").doc(),
        auditEventData({
          salonId,
          branchId,
          actorId: uid,
          actorRole: user.role,
          action: "point_request.auto_approved",
          targetType: "point_request",
          targetId: sessionId,
          before: { status: "serving", points: pointsBefore },
          after: { status: "approved", points: pointsAfter, pointsAdded: pointsRequested },
          createdAt: now,
        }),
      );
      tx.set(
        db.collection("audit_events").doc(),
        auditEventData({
          salonId,
          branchId,
          actorId: uid,
          actorRole: user.role,
          action: "session.completed",
          targetType: "chair_session",
          targetId: sessionId,
          before: { status: "serving" },
          after: { status: "completed", approvalMode },
          createdAt: now,
        }),
      );
    } else {
      tx.set(sessionRef, { status: "pending_approval", updatedAt: now }, { merge: true });
      tx.set(
        activeSessionRefFor(salonId, String(session.customerId || "")),
        {
          salonId,
          branchId,
          branchName: session.branchName ?? "",
          branchAddress: session.branchAddress ?? "",
          customerId: session.customerId,
          sessionId,
          qrType: session.qrType ?? null,
          legacyMirrorId: session.legacyMirrorId ?? null,
          status: "pending_approval",
          assignedStaffId: uid,
          assignedStaffName: staffName,
          createdAt: session.createdAt ?? now,
          updatedAt: now,
        },
        { merge: true },
      );
    }
    for (const operationSnap of operationSnaps) {
      tx.set(
        operationSnap.ref,
        {
          attachmentStatus: "attached",
          attachedTo: { type: "point_request", id: requestRef.id },
          attachedAt: now,
          orphanExpiresAt: null,
          updatedAt: now,
        },
        { merge: true },
      );
    }
  });

  return {
    requestId: requestRef.id,
    alreadySubmitted,
    status: resultStatus,
    approvalMode,
    pointsAdded: pointsRequested,
    pointsAfter: resultPointsAfter,
  };
});

export const updatePendingPointRequestPhotos = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  const photoUrls = safePhotoUrls(request.data?.photoUrls);
  const photoPaths = safePhotoPaths(request.data?.photoPaths);
  await assertSalonRole(uid, salonId, ["owner"]);

  const requestRef = db.collection("point_requests").doc(requestId);
  const requestSnap = await requestRef.get();
  const pointRequest = requestSnap.data();
  if (!requestSnap.exists || pointRequest?.salonId !== salonId) {
    throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
  }
  if (pointRequest.status !== "pending") {
    throw new HttpsError("failed-precondition", "Yêu cầu này đã được xử lý");
  }

  const sessionId = String(pointRequest.sessionId || requestId);
  const customerId = String(pointRequest.customerId || "");
  const branchId = String(pointRequest.branchId || "");
  if (!sessionId || !customerId || !branchId) {
    throw new HttpsError("failed-precondition", "Yêu cầu chưa có đủ thông tin lượt cắt");
  }

  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const customerRef = db.collection("customers").doc(customerId);
  const [sessionSnap, customerSnap] = await Promise.all([sessionRef.get(), customerRef.get()]);
  if (
    !sessionSnap.exists ||
    sessionSnap.data()?.salonId !== salonId ||
    sessionSnap.data()?.branchId !== branchId ||
    sessionSnap.data()?.customerId !== customerId ||
    sessionSnap.data()?.status !== "pending_approval"
  ) {
    throw new HttpsError("failed-precondition", "Lượt cắt không còn chờ chủ salon duyệt");
  }
  if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
    throw new HttpsError("failed-precondition", "Không tìm thấy hồ sơ khách trong salon");
  }
  if ((photoUrls.length > 0 || photoPaths.length > 0) && customerSnap.data()?.allowPhoto !== true) {
    throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
  }

  const existingPhotoUrls = safePhotoUrls(pointRequest.photoUrls);
  const addedPhotoUrls = photoUrls.filter((photoUrl) => !existingPhotoUrls.includes(photoUrl));
  const existingPhotoPaths = safePhotoPaths(pointRequest.photoPaths);
  const addedPhotoPaths = photoPaths.filter((photoPath) => !existingPhotoPaths.includes(photoPath));
  if (addedPhotoUrls.length > 0 || addedPhotoPaths.length > 0) {
    await assertFeatureEnabled(
      salonId,
      "photoUploadEnabled",
      "Tính năng lưu ảnh kiểu tóc đang tạm ngừng.",
      request.data?.appVersion,
    );
  }
  await assertSubmittedHaircutPhotos({
    photoUrls: addedPhotoUrls,
    salonId,
    branchId,
    customerId,
    sessionId,
    uploaderUid: uid,
  });
  await assertFinalizedPhotoUploadPaths({
    photoPaths: addedPhotoPaths,
    salonId,
    branchId,
    customerId,
    sessionId,
    uploaderUid: uid,
  });

  await db.runTransaction(async (tx) => {
    const [currentRequestSnap, currentSessionSnap, currentCustomerSnap] = await Promise.all([
      tx.get(requestRef),
      tx.get(sessionRef),
      tx.get(customerRef),
    ]);
    const currentRequest = currentRequestSnap.data();
    const currentSession = currentSessionSnap.data();
    const currentCustomer = currentCustomerSnap.data();

    if (
      !currentRequestSnap.exists ||
      currentRequest?.salonId !== salonId ||
      currentRequest?.branchId !== branchId ||
      currentRequest?.customerId !== customerId ||
      String(currentRequest?.sessionId || requestId) !== sessionId ||
      currentRequest?.status !== "pending"
    ) {
      throw new HttpsError("failed-precondition", "Yêu cầu này không còn chờ duyệt");
    }
    if (
      !currentSessionSnap.exists ||
      currentSession?.salonId !== salonId ||
      currentSession?.branchId !== branchId ||
      currentSession?.status !== "pending_approval" ||
      currentSession?.customerId !== customerId
    ) {
      throw new HttpsError("failed-precondition", "Lượt cắt không còn chờ chủ salon duyệt");
    }
    if (
      !currentCustomerSnap.exists ||
      currentCustomer?.salonId !== salonId ||
      ((photoUrls.length > 0 || photoPaths.length > 0) && currentCustomer?.allowPhoto !== true)
    ) {
      throw new HttpsError("failed-precondition", "Khách chưa đồng ý lưu ảnh kiểu tóc");
    }

    const currentPhotoUrls = safePhotoUrls(currentRequest.photoUrls);
    const allowedPhotoUrls = new Set([...currentPhotoUrls, ...addedPhotoUrls]);
    const currentPhotoPaths = safePhotoPaths(currentRequest.photoPaths);
    const operationSnaps = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const photoPath of new Set([...currentPhotoPaths, ...photoPaths])) {
      const operationId = operationIdFromPhotoPath(photoPath);
      if (!operationId) {
        throw new HttpsError("invalid-argument", "Đường dẫn ảnh không hợp lệ");
      }
      operationSnaps.set(
        photoPath,
        await tx.get(db.collection("photo_upload_operations").doc(operationId)),
      );
    }
    const allowedPhotoPaths = new Set([...currentPhotoPaths, ...addedPhotoPaths]);
    if (photoUrls.some((photoUrl) => !allowedPhotoUrls.has(photoUrl))) {
      throw new HttpsError("invalid-argument", "Danh sách có ảnh chưa được xác thực");
    }
    if (photoPaths.some((photoPath) => !allowedPhotoPaths.has(photoPath))) {
      throw new HttpsError("invalid-argument", "Danh sách có ảnh chưa được xác thực");
    }
    for (const [photoPath, operationSnap] of operationSnaps) {
      const operation = operationSnap.data();
      if (
        !operationSnap.exists ||
        operation?.status !== "finalized" ||
        operation?.salonId !== salonId ||
        operation?.branchId !== branchId ||
        operation?.customerId !== customerId ||
        operation?.sessionId !== sessionId ||
        operation?.storagePath !== photoPath
      ) {
        throw new HttpsError("failed-precondition", "Ảnh tải lên không còn hợp lệ");
      }
    }

    const customerSummary =
      currentRequest.customerSummary && typeof currentRequest.customerSummary === "object"
        ? currentRequest.customerSummary
        : {};
    tx.set(
      requestRef,
      {
        photoUrls,
        photoPaths,
        customerSummary: {
          ...customerSummary,
          allowPhoto: Boolean(currentCustomer.allowPhoto),
        },
        photosUpdatedBy: uid,
        photosUpdatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    const operationNow = Timestamp.now();
    for (const [photoPath, operationSnap] of operationSnaps) {
      const attached = photoPaths.includes(photoPath);
      tx.set(
        operationSnap.ref,
        attached
          ? {
              attachmentStatus: "attached",
              attachedTo: { type: "point_request", id: requestId },
              attachedAt: operationNow,
              orphanExpiresAt: null,
              updatedAt: operationNow,
            }
          : {
              attachmentStatus: "unattached",
              attachedTo: null,
              attachedAt: null,
              orphanExpiresAt: Timestamp.fromMillis(
                operationNow.toMillis() + PHOTO_UPLOAD_ORPHAN_TTL_MS,
              ),
              updatedAt: operationNow,
            },
        { merge: true },
      );
    }
  });

  return { photoUrls, photoPaths };
});

export const claimServiceSession = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await enforceAuthenticatedRateLimit("claimServiceSession", uid, salonId);
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
      throw apiError("not-found", ApiErrorCode.INVALID_REQUEST, "Không tìm thấy lượt phục vụ");
    }

    const session = sessionSnap.data() ?? {};
    const branchId = String(session.branchId || "");
    if (!branchId) {
      throw new HttpsError("failed-precondition", "Lượt cắt chưa được gắn chi nhánh");
    }
    await assertBranchAccess(user, branchId);
    const branchSnap = await tx.get(db.collection("branches").doc(branchId));
    assertBranchIsOperational(branchSnap.data(), salonId, branchId);
    if (!isFreshServiceSession(session.createdAt, now, session.expiresAt)) {
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
        throw apiError(
          "failed-precondition",
          ApiErrorCode.SESSION_ALREADY_CLAIMED,
          `Khách đã được ${String(session.assignedStaffName || "nhân viên khác")} nhận`,
        );
      }
      assignedStaffName = String(session.assignedStaffName || assignedStaffName);
      return;
    }

    if (session.status !== "waiting") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.SESSION_NOT_OPEN,
        "Lượt này không còn ở trạng thái chờ nhận",
      );
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
        branchId,
        branchName: session.branchName ?? "",
        branchAddress: session.branchAddress ?? "",
        customerId: session.customerId,
        sessionId,
        qrType: session.qrType ?? null,
        legacyMirrorId: session.legacyMirrorId ?? null,
        ...assignment,
        createdAt: session.createdAt ?? now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: user.role,
        action: "session.claimed",
        targetType: "chair_session",
        targetId: sessionId,
        before: { status: "waiting" },
        after: { status: "serving", assignedStaffId: uid },
        createdAt: now,
      }),
    );
  });

  return { status: resultStatus, assignedStaffId, assignedStaffName };
});

export const cancelServiceSession = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const sessionId = requireString(request.data?.sessionId, "sessionId");
  const cancellationReason = request.data?.reason === "no_show" ? "no_show" : "cancelled";
  const note = optionalLimitedString(request.data?.note, "note", 200) ?? "";
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const pointRequestRef = db.collection("point_requests").doc(sessionId);
  const now = Timestamp.now();

  const cancelledPhotos = await db.runTransaction(async (tx) => {
    const [sessionSnap, pointRequestSnap] = await Promise.all([
      tx.get(sessionRef),
      tx.get(pointRequestRef),
    ]);
    if (!sessionSnap.exists || sessionSnap.data()?.salonId !== salonId) {
      throw apiError("not-found", ApiErrorCode.INVALID_REQUEST, "Không tìm thấy lượt cắt");
    }

    const session = sessionSnap.data() ?? {};
    const branchId = String(session.branchId || "");
    await assertBranchAccess(user, branchId);
    const branchSnap = await tx.get(db.collection("branches").doc(branchId));
    assertBranchIsOperational(branchSnap.data(), salonId, branchId);
    if (session.status === "cancelled") {
      return null;
    }

    const assignedBranchIds = Array.isArray(user.branchIds)
      ? user.branchIds.filter((value): value is string => typeof value === "string")
      : user.branchId
        ? [user.branchId]
        : [];
    if (
      !canCancelServiceSession({
        userId: uid,
        role: user.role,
        assignedBranchIds,
        branchId,
        status: session.status,
        assignedStaffId: session.assignedStaffId,
      })
    ) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.SESSION_NOT_OPEN,
        "Bạn không được hủy lượt cắt này",
      );
    }

    const customerId = String(session.customerId || "");
    const activeRef = activeSessionRefFor(salonId, customerId);
    const activeSnap = await tx.get(activeRef);
    tx.set(
      sessionRef,
      {
        status: "cancelled",
        isOpen: false,
        cancellationReason,
        cancellationNote: note,
        cancelledBy: uid,
        cancelledAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    if (activeSnap.exists && activeSnap.data()?.sessionId === sessionId) {
      tx.delete(activeRef);
    }
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: user.role,
        action: "session.cancelled",
        targetType: "chair_session",
        targetId: sessionId,
        before: { status: session.status ?? null },
        after: { status: "cancelled", cancellationReason },
        createdAt: now,
      }),
    );

    const pointRequest = pointRequestSnap.exists ? pointRequestSnap.data() : null;
    if (pointRequest?.status === "pending") {
      if (user.role !== "owner") {
        throw new HttpsError(
          "failed-precondition",
          "Yêu cầu điểm đang chờ duyệt; chỉ chủ salon được hủy lượt",
        );
      }
      tx.set(
        pointRequestRef,
        {
          status: "rejected",
          rejectedBy: uid,
          rejectedAt: now,
          rejectionReason: cancellationReason,
          photoUrls: [],
          photoPaths: [],
          updatedAt: now,
        },
        { merge: true },
      );
      return {
        photoUrls: pointRequest.photoUrls,
        photoPaths: pointRequest.photoPaths,
        customerId,
        sessionId,
      };
    }
    return null;
  });

  if (cancelledPhotos) {
    await deleteSubmittedHaircutPhotos({ ...cancelledPhotos, salonId });
  }
  return { ok: true, status: "cancelled", cancellationReason };
});

export const expireStaleServiceSessions = onSchedule(
  {
    ...functionOptions,
    schedule: "every 15 minutes",
    timeZone: "Asia/Bangkok",
    timeoutSeconds: 300,
  },
  async () => {
    const now = Timestamp.now();
    const staleSnap = await db
      .collection("chair_sessions")
      .where("isOpen", "==", true)
      .where("expiresAt", "<=", now)
      .limit(SESSION_EXPIRY_BATCH_SIZE)
      .get();

    let expiredCount = 0;
    for (const staleDoc of staleSnap.docs) {
      const expiredSession = await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(staleDoc.ref);
        const session = sessionSnap.data() ?? {};
        if (
          !sessionSnap.exists ||
          session.isOpen !== true ||
          !OPEN_SESSION_STATUSES.includes(
            String(session.status) as (typeof OPEN_SESSION_STATUSES)[number],
          ) ||
          !isServiceSessionExpired(timestampMillis(session.expiresAt), now.toMillis())
        ) {
          return null;
        }

        const salonId = String(session.salonId || "");
        const branchId = String(session.branchId || "");
        const customerId = String(session.customerId || "");
        if (!salonId || !customerId) {
          console.warn("Không thể hết hạn lượt thiếu thông tin tenant", {
            sessionId: staleDoc.id,
          });
          return null;
        }

        const activeRef = activeSessionRefFor(salonId, customerId);
        const pointRequestRef = db.collection("point_requests").doc(staleDoc.id);
        const [activeSnap, pointRequestSnap] = await Promise.all([
          tx.get(activeRef),
          tx.get(pointRequestRef),
        ]);
        const pointRequest = pointRequestSnap.data();
        const shouldRejectPointRequest =
          pointRequestSnap.exists &&
          pointRequest?.status === "pending" &&
          pointRequest.salonId === salonId &&
          pointRequest.customerId === customerId &&
          pointRequest.sessionId === staleDoc.id;

        tx.set(
          staleDoc.ref,
          {
            status: "cancelled",
            isOpen: false,
            cancellationReason: "expired",
            cancelledAt: now,
            updatedAt: now,
          },
          { merge: true },
        );
        if (activeSnap.exists && activeSnap.data()?.sessionId === staleDoc.id) {
          tx.delete(activeRef);
        }
        tx.set(
          db.collection("audit_events").doc(),
          auditEventData({
            salonId,
            branchId,
            actorId: "system",
            actorRole: "system",
            action: "session.expired",
            targetType: "chair_session",
            targetId: staleDoc.id,
            before: { status: session.status ?? null },
            after: { status: "cancelled", cancellationReason: "expired" },
            createdAt: now,
          }),
        );

        if (shouldRejectPointRequest) {
          tx.set(
            pointRequestRef,
            {
              status: "rejected",
              rejectedBy: "system",
              rejectedAt: now,
              processedBy: "system",
              processedAt: now,
              rejectionReason: "expired",
              photoUrls: [],
              photoPaths: [],
              updatedAt: now,
            },
            { merge: true },
          );
          tx.set(
            db.collection("audit_events").doc(),
            auditEventData({
              salonId,
              branchId,
              actorId: "system",
              actorRole: "system",
              action: "point_request.rejected",
              targetType: "point_request",
              targetId: staleDoc.id,
              before: { status: "pending" },
              after: { status: "rejected", rejectionReason: "expired" },
              createdAt: now,
            }),
          );
        }

        return {
          salonId,
          customerId,
          sessionId: staleDoc.id,
          photoUrls: shouldRejectPointRequest ? pointRequest?.photoUrls : [],
          photoPaths: shouldRejectPointRequest ? pointRequest?.photoPaths : [],
        };
      });
      if (!expiredSession) {
        continue;
      }

      expiredCount += 1;
      await deleteSubmittedHaircutPhotos(expiredSession);
    }

    console.info("Đã xử lý lượt cắt hết hạn", { expiredCount });
  },
);

export const cleanupExpiredPhotoUploads = onSchedule(
  { region: "asia-southeast1", schedule: "every 30 minutes", timeoutSeconds: 300 },
  async () => {
    const now = Timestamp.now();
    const [expiredSnapshot, orphanSnapshot] = await Promise.all([
      db
        .collection("photo_upload_operations")
        .where("status", "in", ["pending", "uploading", "uploaded", "failed"])
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt", "asc")
        .limit(100)
        .get(),
      db
        .collection("photo_upload_operations")
        .where("attachmentStatus", "==", "unattached")
        .where("orphanExpiresAt", "<=", now)
        .orderBy("orphanExpiresAt", "asc")
        .limit(100)
        .get(),
    ]);
    const operations = new Map(
      [...expiredSnapshot.docs, ...orphanSnapshot.docs].map((doc) => [doc.id, doc]),
    );
    let cleaned = 0;
    let failed = 0;

    for (const operationSnap of operations.values()) {
      const operation = operationSnap.data();
      const operationId = operationSnap.id;
      const path = String(operation.storagePath || "");
      const validPath = isExpectedPhotoUploadPath(path, {
        salonId: String(operation.salonId || ""),
        customerId: String(operation.customerId || ""),
        sessionId: String(operation.sessionId || ""),
        operationId,
      });
      if (!validPath) {
        failed += 1;
        await operationSnap.ref.set(
          {
            status: "failed",
            cleanupStatus: "blocked",
            failureCode: "INVALID_STORAGE_PATH",
            updatedAt: now,
          },
          { merge: true },
        );
        continue;
      }
      try {
        await storage.bucket().file(path).delete({ ignoreNotFound: true });
        await operationSnap.ref.set(
          {
            status: "expired",
            cleanupStatus: "completed",
            cleanedAt: now,
            updatedAt: now,
          },
          { merge: true },
        );
        cleaned += 1;
      } catch {
        failed += 1;
        await operationSnap.ref.set(
          {
            cleanupStatus: "pending",
            failureCode: "STORAGE_DELETE_FAILED",
            updatedAt: now,
          },
          { merge: true },
        );
      }
    }
    console.info("Photo upload cleanup completed", {
      scanned: operations.size,
      expiredScanned: expiredSnapshot.size,
      orphanScanned: orphanSnapshot.size,
      cleaned,
      failed,
    });
  },
);

export const approvePointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  const owner = await assertSalonRole(uid, salonId, ["owner"]);
  await enforceAuthenticatedRateLimit("approvePointRequest", uid, salonId);
  await assertFeatureEnabled(
    salonId,
    "pointApprovalEnabled",
    "Tính năng gửi và duyệt điểm đang tạm ngừng.",
    request.data?.appVersion,
  );

  const requestRef = db.collection("point_requests").doc(requestId);
  const now = Timestamp.now();
  let alreadyProcessed = false;

  const discardedPhotos = await db.runTransaction(async (tx) => {
    const pointSnap = await tx.get(requestRef);
    if (!pointSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
    }
    const pointRequest = pointSnap.data();
    if (pointRequest?.salonId !== salonId) {
      throw new HttpsError("permission-denied", "Yêu cầu không thuộc salon này");
    }
    if (pointRequest?.status === "approved") {
      alreadyProcessed = true;
      return null;
    }
    if (pointRequest?.status !== "pending") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.REQUEST_ALREADY_PROCESSED,
        "Yêu cầu đã được xử lý",
      );
    }
    const branchId = String(pointRequest?.branchId || "");
    if (!branchId) {
      throw new HttpsError("failed-precondition", "Yêu cầu chưa được gắn chi nhánh");
    }

    const customerRef = db.collection("customers").doc(pointRequest.customerId);
    const sessionRef = db.collection("chair_sessions").doc(pointRequest.sessionId);
    const branchRef = db.collection("branches").doc(branchId);
    const [customerSnap, sessionSnap, branchSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(sessionRef),
      tx.get(branchRef),
    ]);
    if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
      throw new HttpsError("failed-precondition", "Hồ sơ khách không thuộc salon này");
    }
    if (
      !sessionSnap.exists ||
      sessionSnap.data()?.salonId !== salonId ||
      sessionSnap.data()?.branchId !== branchId ||
      sessionSnap.data()?.customerId !== pointRequest.customerId ||
      sessionSnap.data()?.status !== "pending_approval"
    ) {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_REQUEST,
        "Lượt cắt của yêu cầu không hợp lệ",
      );
    }
    assertBranchIsOperational(branchSnap.data(), salonId, branchId);
    const recordId = createHash("sha256").update(`haircut-record:${requestId}`).digest("hex");
    const recordRef = db.collection("haircut_records").doc(recordId);
    const pointsAdded = Number(pointRequest.pointsRequested ?? pointRequest.pointsAdded ?? 1);
    const pointsBefore = Math.max(0, Number(customerSnap.data()?.points ?? 0));
    const pointsAfter = pointsBefore + pointsAdded;
    const canKeepPhotos = customerSnap.data()?.allowPhoto === true;
    const recordPhotoUrls = canKeepPhotos
      ? trustedStoredHaircutPhotoUrls(pointRequest.photoUrls, {
          salonId,
          customerId: String(pointRequest.customerId || ""),
          sessionId: String(pointRequest.sessionId || ""),
        })
      : [];
    const recordPhotoPaths = canKeepPhotos
      ? trustedStoredHaircutPhotoPaths(pointRequest.photoPaths, {
          salonId,
          customerId: String(pointRequest.customerId || ""),
          sessionId: String(pointRequest.sessionId || ""),
        })
      : [];

    if (!Number.isFinite(pointsAdded) || pointsAdded <= 0) {
      throw new HttpsError("failed-precondition", "Số điểm cộng không hợp lệ");
    }

    tx.update(customerRef, {
      points: pointsAfter,
      lastVisitAt: now,
      updatedAt: now,
    });
    tx.update(requestRef, {
      status: "approved",
      approvedBy: uid,
      approvedAt: now,
      processedBy: uid,
      processedAt: now,
      pointsBefore,
      pointsAfter,
      photoUrls: recordPhotoUrls,
      photoPaths: recordPhotoPaths,
      updatedAt: now,
    });
    tx.set(recordRef, {
      salonId,
      branchId,
      branchName: pointRequest.branchName ?? "",
      customerId: pointRequest.customerId,
      staffId: pointRequest.staffId,
      staffName: pointRequest.staffName ?? "",
      pointRequestId: requestId,
      note: pointRequest.note ?? "",
      photoUrls: recordPhotoUrls,
      photoPaths: recordPhotoPaths,
      pointsAdded,
      approvedBy: uid,
      createdAt: now,
    });
    tx.set(
      sessionRef,
      {
        status: "completed",
        isOpen: false,
        completedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: owner.role,
        action: "point_request.approved",
        targetType: "point_request",
        targetId: requestId,
        before: { status: "pending", points: pointsBefore },
        after: { status: "approved", points: pointsAfter, pointsAdded },
        createdAt: now,
      }),
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: owner.role,
        action: "session.completed",
        targetType: "chair_session",
        targetId: String(pointRequest.sessionId || ""),
        before: { status: sessionSnap.data()?.status ?? null },
        after: { status: "completed" },
        createdAt: now,
      }),
    );

    return canKeepPhotos
      ? null
      : {
          photoUrls: pointRequest.photoUrls,
          photoPaths: pointRequest.photoPaths,
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

  return { ok: true, alreadyProcessed };
});

export const rejectPointRequest = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const requestId = requireString(request.data?.requestId, "requestId");
  const reason = requirePointRejectionReason(request.data?.reason);
  const owner = await assertSalonRole(uid, salonId, ["owner"]);
  await enforceAuthenticatedRateLimit("rejectPointRequest", uid, salonId);
  await assertFeatureEnabled(
    salonId,
    "pointApprovalEnabled",
    "Tính năng gửi và duyệt điểm đang tạm ngừng.",
    request.data?.appVersion,
  );

  const requestRef = db.collection("point_requests").doc(requestId);
  const now = Timestamp.now();
  let alreadyProcessed = false;

  const rejectedPhotos = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.data()?.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy yêu cầu cộng điểm");
    }

    const pointRequest = snap.data();
    if (pointRequest?.status === "rejected") {
      alreadyProcessed = true;
      return null;
    }
    if (pointRequest?.status !== "pending") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.REQUEST_ALREADY_PROCESSED,
        "Yêu cầu đã được xử lý",
      );
    }

    const branchId = String(pointRequest?.branchId || "");
    const sessionId = String(pointRequest?.sessionId || "");
    if (!branchId || !sessionId) {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_REQUEST,
        "Yêu cầu chưa có đủ thông tin lượt cắt",
      );
    }
    const [sessionSnap, branchSnap] = await Promise.all([
      tx.get(db.collection("chair_sessions").doc(sessionId)),
      tx.get(db.collection("branches").doc(branchId)),
    ]);
    if (
      !sessionSnap.exists ||
      sessionSnap.data()?.salonId !== salonId ||
      sessionSnap.data()?.branchId !== branchId ||
      sessionSnap.data()?.customerId !== pointRequest.customerId ||
      sessionSnap.data()?.status !== "pending_approval"
    ) {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_REQUEST,
        "Lượt cắt của yêu cầu không hợp lệ",
      );
    }
    assertBranchIsOperational(branchSnap.data(), salonId, branchId);

    tx.set(
      requestRef,
      {
        status: "rejected",
        rejectedBy: uid,
        rejectedAt: now,
        processedBy: uid,
        processedAt: now,
        rejectionReason: reason,
        photoUrls: [],
        photoPaths: [],
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("chair_sessions").doc(sessionId),
      {
        status: "cancelled",
        isOpen: false,
        cancellationReason: "rejected",
        cancelledAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.delete(activeSessionRefFor(salonId, String(pointRequest.customerId || "")));
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: owner.role,
        action: "point_request.rejected",
        targetType: "point_request",
        targetId: requestId,
        before: { status: "pending" },
        after: { status: "rejected", reasonProvided: Boolean(reason) },
        createdAt: now,
      }),
    );

    return {
      photoUrls: pointRequest.photoUrls,
      photoPaths: pointRequest.photoPaths,
      customerId: String(pointRequest.customerId || ""),
      sessionId: String(pointRequest.sessionId || ""),
    };
  });

  if (rejectedPhotos) {
    await deleteSubmittedHaircutPhotos({
      ...rejectedPhotos,
      salonId,
    });
  }

  return { ok: true, alreadyProcessed };
});

export const getOwnerOverview = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  await assertSalonRole(uid, salonId, ["owner"]);
  const branchId = optionalString(request.data?.branchId);
  if (branchId) {
    const branchSnap = await db.collection("branches").doc(branchId).get();
    if (!branchSnap.exists || branchSnap.data()?.salonId !== salonId) {
      throw new HttpsError("invalid-argument", "Chi nhánh lọc không thuộc salon này");
    }
  }

  const startOfToday = Timestamp.fromMillis(startOfTodayBangkokMs());
  const nowMs = Date.now();
  const start7DaysMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const start30DaysMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const start30Days = Timestamp.fromMillis(start30DaysMs);
  const inactiveCutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  let completedQuery = db
    .collection("haircut_records")
    .where("salonId", "==", salonId)
    .where("createdAt", ">=", start30Days);
  let pendingQuery = db
    .collection("point_requests")
    .where("salonId", "==", salonId)
    .where("status", "==", "pending");
  let approvedQuery = db
    .collection("point_requests")
    .where("salonId", "==", salonId)
    .where("status", "==", "approved")
    .where("approvedAt", ">=", startOfToday);
  let spinsQuery = db
    .collection("reward_history")
    .where("salonId", "==", salonId)
    .where("createdAt", ">=", startOfToday);
  let unusedRewardsQuery = db
    .collection("reward_history")
    .where("salonId", "==", salonId)
    .where("status", "==", "unused");
  let inactiveCustomersQuery = db
    .collection("customers")
    .where("salonId", "==", salonId)
    .where("lastVisitAt", "<", Timestamp.fromMillis(inactiveCutoffMs));

  if (branchId) {
    completedQuery = completedQuery.where("branchId", "==", branchId);
    pendingQuery = pendingQuery.where("branchId", "==", branchId);
    approvedQuery = approvedQuery.where("branchId", "==", branchId);
    spinsQuery = spinsQuery.where("branchId", "==", branchId);
    unusedRewardsQuery = unusedRewardsQuery.where("branchId", "==", branchId);
    inactiveCustomersQuery = inactiveCustomersQuery.where("lastBranchId", "==", branchId);
  }

  const [
    completedSnap,
    pendingRequestsSnap,
    approvedPointsTodaySnap,
    spinsTodaySnap,
    unusedRewardsSnap,
    customersSnap,
  ] = await Promise.all([
    completedQuery.select("customerId", "createdAt").get(),
    pendingQuery.count().get(),
    approvedQuery.aggregate({ points: AggregateField.sum("pointsAdded") }).get(),
    spinsQuery.count().get(),
    unusedRewardsQuery.count().get(),
    inactiveCustomersQuery.orderBy("lastVisitAt", "asc").limit(5).get(),
  ]);

  const completedRecords = completedSnap.docs.map((doc) => ({
    customerId: doc.data().customerId,
    createdAtMs: timestampMillis(doc.data().createdAt),
  }));

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
        phone: String(customer.phone ?? ""),
        phoneLast4: String(customer.phoneLast4 ?? ""),
        points: Number(customer.points ?? 0),
        lastVisitAtMs,
        daysSinceLastVisit,
      };
    })
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);

  return {
    customersToday: countUniqueCustomersSince(completedRecords, startOfToday.toMillis()),
    customers7Days: countUniqueCustomersSince(completedRecords, start7DaysMs),
    customers30Days: countUniqueCustomersSince(completedRecords, start30DaysMs),
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

  const requiredPoints = requireBoundedPositiveNumber(
    request.data?.requiredPoints,
    "requiredPoints",
    10_000,
  );
  const rewardValidityDays = requireBoundedPositiveNumber(
    request.data?.rewardValidityDays ?? 90,
    "rewardValidityDays",
    365,
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
      label: limitedString((slot as { label: string }).label, `slots[${index}].label`, 60),
      active: Boolean((slot as { active?: boolean }).active ?? true),
      type: normalizeWheelSlotType(
        (slot as { type?: unknown }).type,
        (slot as { label: string }).label,
      ),
    };
  });
  if (!cleanedSlots.some((slot) => slot.active)) {
    throw new HttpsError("invalid-argument", "Vòng quay phải có ít nhất một ô đang bật");
  }

  const wheelRef = db.collection("lucky_wheel").doc(salonId);
  const wheelSnap = await wheelRef.get();
  const now = Timestamp.now();
  const wheelBatch = db.batch();
  wheelBatch.set(
    wheelRef,
    {
      salonId,
      requiredPoints,
      rewardValidityDays,
      deductPointsAfterSpin,
      slots: cleanedSlots,
      updatedAt: now,
    },
    { merge: true },
  );
  wheelBatch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId,
      actorId: uid,
      action: "wheel.config_updated",
      targetType: "lucky_wheel",
      targetId: salonId,
      before: {
        requiredPoints: wheelSnap.data()?.requiredPoints ?? null,
        rewardValidityDays: wheelSnap.data()?.rewardValidityDays ?? null,
      },
      after: {
        requiredPoints,
        rewardValidityDays,
        activeSlots: cleanedSlots.filter((slot) => slot.active).length,
      },
      createdAt: now,
    }),
  );
  await wheelBatch.commit();

  return { ok: true };
});

export const spinLuckyWheel = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  const idempotencyKey = requireIdempotencyKey(request.data?.idempotencyKey);
  await assertSalonRole(uid, salonId, ["owner"]);
  await enforceAuthenticatedRateLimit("spinLuckyWheel", uid, salonId);

  return spinWheelForCustomer(salonId, customerId, idempotencyKey, request.data?.appVersion);
});

export const spinLuckyWheelFromZalo = onCall(zaloFunctionOptions, async (request) => {
  const salonId = requireString(request.data?.salonId, "salonId");
  const idempotencyKey = requireIdempotencyKey(request.data?.idempotencyKey);
  await enforcePublicRequestPolicy(
    "spinLuckyWheelFromZalo",
    request,
    salonId,
    request.data?.zaloAccessToken,
  );
  const zaloProfile = await verifyZaloAccessToken(request.data?.zaloAccessToken);
  const customerId = customerIdFor(salonId, zaloProfile.zaloUserId);

  return spinWheelForCustomer(salonId, customerId, idempotencyKey, request.data?.appVersion);
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

  const [customerSnap, sessionSnap, wheelSnap, features] = await Promise.all([
    db.collection("customers").doc(customerId).get(),
    db.collection("chair_sessions").doc(sessionId).get(),
    db.collection("lucky_wheel").doc(salonId).get(),
    getSystemFeatures(salonId),
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
            ? (slot as { label?: unknown; active?: unknown; type?: unknown })
            : {};
        const label = typeof value.label === "string" ? value.label.trim() : "";
        return {
          label,
          active: value.active !== false,
          type: normalizeWheelSlotType(value.type, label),
        };
      })
    : [];

  return {
    identityBinding: createHash("sha256").update(zaloProfile.zaloUserId).digest("hex"),
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
    branchId: String(session.branchId ?? ""),
    branchName: String(session.branchName ?? session.mirrorName ?? ""),
    branchAddress: String(session.branchAddress ?? ""),
    mirrorName: String(session.branchName ?? session.mirrorName ?? ""),
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
    features,
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

  const [recordsSnap, customerSnap, salonSnap] = await Promise.all([
    db
      .collection("haircut_records")
      .where("salonId", "==", salonId)
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get(),
    db.collection("customers").doc(customerId).get(),
    db.collection("salons").doc(salonId).get(),
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
    if (doc.exists && doc.data()?.salonId === salonId && typeof name === "string") {
      staffNames.set(doc.id, name);
    }
  });
  const salonName =
    salonSnap.exists && typeof salonSnap.data()?.name === "string" ? salonSnap.data()?.name : "";

  return {
    records: await Promise.all(
      recordsSnap.docs.map(async (doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          createdAtMs: timestampMillis(data.createdAt),
          salonName,
          branchId: typeof data.branchId === "string" ? data.branchId : "",
          branchName: typeof data.branchName === "string" ? data.branchName : "",
          staffName:
            staffNames.get(data.staffId) ??
            (typeof data.staffName === "string" ? data.staffName : ""),
          serviceName: typeof data.serviceName === "string" ? data.serviceName : "",
          rewardName: typeof data.rewardName === "string" ? data.rewardName : "",
          note: data.note ?? "",
          photoUrls: canViewPhotos
            ? await resolvedHaircutPhotoUrls(data.photoUrls, data.photoPaths, {
                salonId,
                customerId,
                sessionId: String(data.pointRequestId || ""),
              })
            : [],
          pointsAdded: data.pointsAdded ?? 0,
        };
      }),
    ),
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

  const nowMs = Date.now();
  return {
    rewards: rewardsSnap.docs.flatMap((doc) => {
      const data = doc.data();
      const status = effectiveRewardStatus(data.status, timestampMillis(data.expiresAt), nowMs);
      if (status === "no_prize") {
        return [];
      }
      return [
        {
          id: doc.id,
          rewardName: data.rewardName ?? "",
          rewardCode: data.rewardCode ?? "",
          status,
          branchName: String(data.branchName || "Chi nhánh phát hành"),
          createdAtMs: timestampMillis(data.createdAt),
          usedAtMs: timestampMillis(data.usedAt),
          expiresAtMs: timestampMillis(data.expiresAt),
        },
      ];
    }),
  };
});

async function assertManagerHistoryBranch(
  user: Awaited<ReturnType<typeof getAppUser>>,
  salonId: string,
  branchId: string | undefined,
) {
  if (!branchId) return;
  await assertBranchAccess(user, branchId);
  const branchSnap = await db.collection("branches").doc(branchId).get();
  if (!branchSnap.exists || branchSnap.data()?.salonId !== salonId) {
    throw apiError(
      "failed-precondition",
      ApiErrorCode.INVALID_BRANCH,
      "Chi nhánh không thuộc salon này",
      { branchId },
    );
  }
}

async function managerCustomerMap(salonId: string, customerIds: string[]) {
  const uniqueIds = [...new Set(customerIds.filter(Boolean))];
  const snapshots =
    uniqueIds.length > 0
      ? await db.getAll(...uniqueIds.map((id) => db.collection("customers").doc(id)))
      : [];
  const customers = new Map<string, DocumentData>();
  snapshots.forEach((snapshot) => {
    if (snapshot.exists && snapshot.data()?.salonId === salonId) {
      customers.set(snapshot.id, snapshot.data() ?? {});
    }
  });
  return customers;
}

function managerCustomerSummary(
  customerId: string,
  storedCustomer: DocumentData | undefined,
  embeddedCustomer: unknown,
  includePhone: boolean,
) {
  const embedded =
    typeof embeddedCustomer === "object" && embeddedCustomer !== null
      ? (embeddedCustomer as Record<string, unknown>)
      : {};
  const customer = storedCustomer ?? {};
  return {
    id: customerId,
    name: String(customer.name ?? embedded.name ?? "Khách hàng"),
    ...(includePhone ? { phone: String(customer.phone ?? "") } : {}),
    phoneLast4: String(customer.phoneLast4 ?? embedded.phoneLast4 ?? ""),
    points: Math.max(0, Number(customer.points ?? embedded.points ?? 0)),
    allowPhoto: Boolean(customer.allowPhoto ?? embedded.allowPhoto),
  };
}

export const getManagerSessionHistory = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = optionalLimitedString(request.data?.branchId, "branchId", 128);
  const limit = boundedQueryLimit(request.data?.limit, 30, 50);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await assertManagerHistoryBranch(user, salonId, branchId);

  let visibleDocs;
  if (user.role === "owner") {
    let historyQuery = db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("status", "in", ["completed", "cancelled"])
      .orderBy("createdAt", "desc")
      .limit(limit);
    if (branchId) historyQuery = historyQuery.where("branchId", "==", branchId);
    visibleDocs = (await historyQuery.get()).docs;
  } else {
    let assignedQuery = db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("assignedStaffId", "==", uid)
      .where("status", "in", ["completed", "cancelled"])
      .orderBy("createdAt", "desc")
      .limit(limit);
    let cancelledQuery = db
      .collection("chair_sessions")
      .where("salonId", "==", salonId)
      .where("cancelledBy", "==", uid)
      .where("status", "==", "cancelled")
      .orderBy("createdAt", "desc")
      .limit(limit);
    if (branchId) {
      assignedQuery = assignedQuery.where("branchId", "==", branchId);
      cancelledQuery = cancelledQuery.where("branchId", "==", branchId);
    }
    const [assignedSnap, cancelledSnap] = await Promise.all([
      assignedQuery.get(),
      cancelledQuery.get(),
    ]);
    const uniqueDocs = new Map(
      [...assignedSnap.docs, ...cancelledSnap.docs].map((doc) => [doc.id, doc]),
    );
    visibleDocs = [...uniqueDocs.values()]
      .filter((doc) => canUserAccessBranch(user, String(doc.data().branchId || "")))
      .sort(
        (left, right) =>
          (timestampMillis(right.data().createdAt) ?? 0) -
          (timestampMillis(left.data().createdAt) ?? 0),
      )
      .slice(0, limit);
  }
  const customers = await managerCustomerMap(
    salonId,
    visibleDocs.map((doc) => String(doc.data().customerId || "")),
  );

  return {
    sessions: visibleDocs.map((doc) => {
      const data = doc.data();
      const customerId = String(data.customerId || "");
      return {
        id: doc.id,
        salonId,
        branchId: String(data.branchId || ""),
        branchName: String(data.branchName || data.mirrorName || "Chi nhánh"),
        branchAddress: String(data.branchAddress || ""),
        customerId,
        status: data.status === "cancelled" ? "cancelled" : "completed",
        assignedStaffId: String(data.assignedStaffId || ""),
        assignedStaffName: String(data.assignedStaffName || ""),
        claimedAtMs: timestampMillis(data.claimedAt),
        createdAtMs: timestampMillis(data.createdAt),
        completedAtMs: timestampMillis(data.completedAt),
        cancelledAtMs: timestampMillis(data.cancelledAt),
        cancellationReason: String(data.cancellationReason || ""),
        customer: managerCustomerSummary(
          customerId,
          customers.get(customerId),
          data.customerSummary,
          user.role === "owner",
        ),
      };
    }),
  };
});

export const getManagerPointRequestHistory = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = optionalLimitedString(request.data?.branchId, "branchId", 128);
  const limit = boundedQueryLimit(request.data?.limit, 30, 50);
  const owner = await assertSalonRole(uid, salonId, ["owner"]);
  await assertManagerHistoryBranch(owner, salonId, branchId);

  let historyQuery = db
    .collection("point_requests")
    .where("salonId", "==", salonId)
    .where("status", "in", ["approved", "rejected"])
    .orderBy("createdAt", "desc")
    .limit(limit);
  if (branchId) historyQuery = historyQuery.where("branchId", "==", branchId);

  const snapshot = await historyQuery.get();
  const customers = await managerCustomerMap(
    salonId,
    snapshot.docs.map((doc) => String(doc.data().customerId || "")),
  );

  return {
    requests: snapshot.docs.map((doc) => {
      const data = doc.data();
      const customerId = String(data.customerId || "");
      return {
        id: doc.id,
        salonId,
        branchId: String(data.branchId || ""),
        branchName: String(data.branchName || "Chi nhánh"),
        sessionId: String(data.sessionId || ""),
        customerId,
        staffName: String(data.staffName || ""),
        note: String(data.note || ""),
        pointsAdded: Math.max(0, Number(data.pointsAdded ?? data.pointsRequested ?? 0)),
        status: data.status === "approved" ? "approved" : "rejected",
        rejectionReason: String(data.rejectionReason || ""),
        createdAtMs: timestampMillis(data.createdAt),
        processedAtMs: timestampMillis(data.processedAt ?? data.approvedAt ?? data.rejectedAt),
        customer: managerCustomerSummary(
          customerId,
          customers.get(customerId),
          data.customerSummary,
          true,
        ),
      };
    }),
  };
});

async function managerRewardDocsForBranch(input: {
  salonId: string;
  branchId: string;
  limit: number;
  usedBy?: string;
}) {
  let currentQuery = db
    .collection("reward_history")
    .where("salonId", "==", input.salonId)
    .where("usedBranchId", "==", input.branchId);
  let legacyQuery = db
    .collection("reward_history")
    .where("salonId", "==", input.salonId)
    .where("branchId", "==", input.branchId);

  if (input.usedBy) {
    currentQuery = currentQuery.where("usedBy", "==", input.usedBy).where("status", "==", "used");
    legacyQuery = legacyQuery.where("usedBy", "==", input.usedBy).where("status", "==", "used");
  }

  const currentSnap = await currentQuery.orderBy("createdAt", "desc").limit(input.limit).get();
  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>(
    currentSnap.docs.map((doc) => [doc.id, doc]),
  );

  const pageSize = Math.min(Math.max(input.limit, 20), 50);
  let legacyCount = 0;
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (legacyCount < input.limit) {
    let pageQuery = legacyQuery.orderBy("createdAt", "desc").limit(pageSize);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();

    for (const doc of page.docs) {
      const data = doc.data();
      if (!data.usedBranchId && !byId.has(doc.id)) {
        byId.set(doc.id, doc);
        legacyCount += 1;
      }
      if (legacyCount >= input.limit) break;
    }
    if (page.size < pageSize) break;
    cursor = page.docs[page.docs.length - 1];
  }

  return [...byId.values()]
    .sort(
      (left, right) =>
        (timestampMillis(right.data().createdAt) ?? 0) -
        (timestampMillis(left.data().createdAt) ?? 0),
    )
    .slice(0, input.limit);
}

export const getManagerRewardHistory = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = optionalLimitedString(request.data?.branchId, "branchId", 128);
  const limit = boundedQueryLimit(request.data?.limit, 30, 50);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await assertManagerHistoryBranch(user, salonId, branchId);

  let rewardDocs: QueryDocumentSnapshot<DocumentData>[];
  if (branchId) {
    rewardDocs = await managerRewardDocsForBranch({
      salonId,
      branchId,
      limit,
      ...(user.role === "staff" ? { usedBy: uid } : {}),
    });
  } else {
    let rewardQuery = db.collection("reward_history").where("salonId", "==", salonId);
    if (user.role === "staff") {
      rewardQuery = rewardQuery.where("usedBy", "==", uid).where("status", "==", "used");
    }
    rewardDocs = (await rewardQuery.orderBy("createdAt", "desc").limit(limit).get()).docs;
  }
  const visibleDocs = rewardDocs
    .filter((doc) => {
      const data = doc.data();
      if (
        effectiveRewardStatus(data.status, timestampMillis(data.expiresAt), Date.now()) ===
        "no_prize"
      ) {
        return false;
      }
      if (branchId && String(data.usedBranchId || data.branchId || "") !== branchId) return false;
      if (user.role === "owner") return true;
      return (
        data.status === "used" &&
        data.usedBy === uid &&
        canUserAccessBranch(user, String(data.usedBranchId || data.branchId || ""))
      );
    })
    .slice(0, limit);
  const customers = await managerCustomerMap(
    salonId,
    visibleDocs.map((doc) => String(doc.data().customerId || "")),
  );

  return {
    rewards: visibleDocs.map((doc) => {
      const data = doc.data();
      const customerId = String(data.customerId || "");
      const rewardCode = String(data.rewardCode || "");
      return {
        id: doc.id,
        rewardName: String(data.rewardName || ""),
        ...(user.role === "owner" ? { rewardCode } : {}),
        rewardCodeLast4: rewardCode.slice(-4),
        status: effectiveRewardStatus(data.status, timestampMillis(data.expiresAt), Date.now()),
        branchId: String(data.usedBranchId || data.branchId || ""),
        customerId,
        customerName: String(customers.get(customerId)?.name || "Khách hàng"),
        ...(user.role === "owner" ? { usedBy: String(data.usedBy || "") } : {}),
        createdAtMs: timestampMillis(data.createdAt),
        usedAtMs: timestampMillis(data.usedAt),
        expiresAtMs: timestampMillis(data.expiresAt),
      };
    }),
  };
});

export const getManagerAuditEvents = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const branchId = optionalLimitedString(request.data?.branchId, "branchId", 128);
  const limit = boundedQueryLimit(request.data?.limit, 30, 50);
  const owner = await assertSalonRole(uid, salonId, ["owner"]);
  await assertManagerHistoryBranch(owner, salonId, branchId);

  let auditQuery = db.collection("audit_events").where("salonId", "==", salonId);
  if (branchId) auditQuery = auditQuery.where("branchId", "==", branchId);
  const snapshot = await auditQuery.orderBy("createdAt", "desc").limit(limit).get();
  const actorIds = [
    ...new Set(
      snapshot.docs
        .map((doc) => String(doc.data().actorUid || doc.data().actorId || ""))
        .filter(Boolean),
    ),
  ];
  const actorSnapshots =
    actorIds.length > 0
      ? await db.getAll(...actorIds.map((actorId) => db.collection("users").doc(actorId)))
      : [];
  const actorNames = new Map<string, string>();
  actorSnapshots.forEach((actorSnapshot) => {
    const actor = actorSnapshot.data();
    if (actorSnapshot.exists && actor?.salonId === salonId) {
      actorNames.set(actorSnapshot.id, String(actor.name || "Người dùng"));
    }
  });

  return {
    events: snapshot.docs.map((doc) => {
      const data = doc.data();
      const actorId = String(data.actorUid || data.actorId || "");
      const actorRole = String(data.actorRole || "");
      const actorName =
        actorNames.get(actorId) ||
        (actorRole === "customer"
          ? "Khách hàng"
          : actorRole === "system" || actorRole === "system_admin"
            ? "Hệ thống"
            : "Người dùng");
      return {
        id: doc.id,
        branchId: String(data.branchId || ""),
        actorId,
        actorName,
        actorRole,
        action: String(data.action || ""),
        targetType: String(data.targetType || ""),
        targetId: String(data.targetId || ""),
        requestId: String(data.requestId || data.correlationId || ""),
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
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await resolveAuthorizedBranchScope(user, salonId, request.data?.branchId);

  const normalizedTerm = normalizeSearchText(term);
  if (normalizedTerm.length < 2) {
    throw new HttpsError("invalid-argument", "Nhập ít nhất 2 ký tự để tìm khách");
  }

  const phoneDigits = term.replace(/\D/g, "");
  const isPhoneSearch = phoneDigits.length === term.replace(/\s/g, "").length;
  if (isPhoneSearch && phoneDigits.length !== 4) {
    throw new HttpsError("invalid-argument", "Vui lòng nhập đủ 4 số cuối điện thoại");
  }

  let customersQuery = db.collection("customers").where("salonId", "==", salonId);
  customersQuery = (
    isPhoneSearch
      ? customersQuery.where("phoneLast4", "==", phoneDigits)
      : customersQuery.where("namePrefixes", "array-contains", normalizedTerm)
  ).orderBy(FieldPath.documentId());

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
      ...(user.role === "owner" ? { phone: String(data.phone ?? "") } : {}),
      phoneLast4: String(data.phoneLast4 ?? ""),
      points: Number(data.points ?? 0),
      allowPhoto: Boolean(data.allowPhoto),
      lastVisitAtMs: timestampMillis(data.lastVisitAt),
    };
  });

  return {
    customers: customers.map((customer) => ({
      ...customer,
      detailsLoaded: false,
      recentRecords: [],
      branchVisits: [],
      rewardHistory: [],
      unusedRewards: [],
    })),
    nextCursor: hasMore ? (pageDocs[pageDocs.length - 1]?.id ?? null) : null,
  };
});

async function customerRewardDocsForDetails(input: {
  salonId: string;
  customerId: string;
  branchId?: string;
  limit: number;
}): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  if (!input.branchId) {
    return (
      await db
        .collection("reward_history")
        .where("salonId", "==", input.salonId)
        .where("customerId", "==", input.customerId)
        .orderBy("createdAt", "desc")
        .limit(input.limit)
        .get()
    ).docs;
  }

  const currentQuery = db
    .collection("reward_history")
    .where("salonId", "==", input.salonId)
    .where("usedBranchId", "==", input.branchId)
    .where("customerId", "==", input.customerId);
  const legacyQuery = db
    .collection("reward_history")
    .where("salonId", "==", input.salonId)
    .where("branchId", "==", input.branchId)
    .where("customerId", "==", input.customerId);
  const currentSnap = await currentQuery.orderBy("createdAt", "desc").limit(input.limit).get();
  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>(
    currentSnap.docs.map((doc) => [doc.id, doc]),
  );

  const pageSize = Math.min(Math.max(input.limit, 20), 50);
  let legacyCount = 0;
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (legacyCount < input.limit) {
    let pageQuery = legacyQuery.orderBy("createdAt", "desc").limit(pageSize);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    for (const doc of page.docs) {
      if (!doc.data().usedBranchId && !byId.has(doc.id)) {
        byId.set(doc.id, doc);
        legacyCount += 1;
      }
      if (legacyCount >= input.limit) break;
    }
    if (page.size < pageSize) break;
    cursor = page.docs[page.docs.length - 1];
  }

  return [...byId.values()]
    .sort(
      (left, right) =>
        (timestampMillis(right.data().createdAt) ?? 0) -
        (timestampMillis(left.data().createdAt) ?? 0),
    )
    .slice(0, input.limit);
}

async function managerCustomerDetails(input: {
  user: AppUser;
  salonId: string;
  branchId?: string;
  customerDoc: QueryDocumentSnapshot<DocumentData> | DocumentData;
  customerId: string;
}) {
  const data =
    typeof input.customerDoc.data === "function" ? input.customerDoc.data() : input.customerDoc;
  const customer = {
    id: input.customerId,
    name: String(data.name ?? ""),
    ...(input.user.role === "owner" ? { phone: String(data.phone ?? "") } : {}),
    phoneLast4: String(data.phoneLast4 ?? ""),
    points: Number(data.points ?? 0),
    allowPhoto: Boolean(data.allowPhoto),
    lastVisitAtMs: timestampMillis(data.lastVisitAt),
  };
  let recordsQuery = db
    .collection("haircut_records")
    .where("salonId", "==", input.salonId)
    .where("customerId", "==", input.customerId);
  if (input.branchId) recordsQuery = recordsQuery.where("branchId", "==", input.branchId);

  const canReadRewardCodes = input.user.role === "owner" || input.user.canRedeemRewards === true;
  const [recordsSnap, rewardDocs] = await Promise.all([
    recordsQuery
      .orderBy("createdAt", "desc")
      .limit(input.user.role === "owner" ? 20 : 5)
      .get(),
    canReadRewardCodes
      ? customerRewardDocsForDetails({
          salonId: input.salonId,
          customerId: input.customerId,
          branchId: input.branchId,
          limit: input.user.role === "owner" ? 20 : 10,
        })
      : Promise.resolve([]),
  ]);
  const recentRecords = await Promise.all(
    recordsSnap.docs.map(async (doc) => {
      const record = doc.data();
      return {
        id: doc.id,
        branchId: String(record.branchId || ""),
        branchName: String(record.branchName || ""),
        staffName: String(record.staffName || ""),
        note: String(record.note || ""),
        pointsAdded: Number(record.pointsAdded ?? 1),
        createdAtMs: timestampMillis(record.createdAt),
        photoUrls:
          input.user.role === "owner" && customer.allowPhoto
            ? await resolvedHaircutPhotoUrls(record.photoUrls, record.photoPaths, {
                salonId: input.salonId,
                customerId: input.customerId,
                sessionId: String(record.pointRequestId || ""),
              })
            : [],
      };
    }),
  );
  const rewardHistory = rewardDocs.flatMap((doc) => {
    const reward = doc.data();
    const status = effectiveRewardStatus(
      reward.status,
      timestampMillis(reward.expiresAt),
      Date.now(),
    );
    if (status === "no_prize") return [];
    return [
      {
        id: doc.id,
        rewardName: String(reward.rewardName || ""),
        rewardCode: canReadRewardCodes ? String(reward.rewardCode || "") : "",
        status,
        branchId: String(reward.usedBranchId || reward.branchId || ""),
        createdAtMs: timestampMillis(reward.createdAt),
        usedAtMs: timestampMillis(reward.usedAt),
        expiresAtMs: timestampMillis(reward.expiresAt),
      },
    ];
  });
  const branchVisits = Array.from(
    recentRecords.reduce((visits, record) => {
      if (record.branchId && !visits.has(record.branchId)) {
        visits.set(record.branchId, {
          branchId: record.branchId,
          branchName: record.branchName || "Chi nhánh",
          lastVisitAtMs: record.createdAtMs,
        });
      }
      return visits;
    }, new Map<string, { branchId: string; branchName: string; lastVisitAtMs: number | null }>()),
  ).map(([, visit]) => visit);

  return {
    ...customer,
    detailsLoaded: true,
    recentRecords,
    branchVisits: input.user.role === "owner" ? branchVisits : [],
    rewardHistory: input.user.role === "owner" ? rewardHistory : [],
    unusedRewards: rewardHistory.filter((reward) => reward.status === "unused"),
  };
}

export const getSalonCustomerDetails = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const branchId = await resolveAuthorizedBranchScope(user, salonId, request.data?.branchId);
  const customerSnap = await db.collection("customers").doc(customerId).get();
  if (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) {
    throw apiError(
      "not-found",
      ApiErrorCode.INVALID_REQUEST,
      "Không tìm thấy hồ sơ khách trong salon này",
    );
  }

  return {
    customer: await managerCustomerDetails({
      user,
      salonId,
      branchId,
      customerDoc: customerSnap.data() ?? {},
      customerId,
    }),
  };
});

export const deleteCustomerData = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const customerId = requireString(request.data?.customerId, "customerId");
  await assertSalonRole(uid, salonId, ["owner"]);

  return runCustomerDeletionJob({
    salonId,
    customerId,
    requestedBy: uid,
    requestSource: "owner",
  });
});

type CustomerDeletionJobInput = {
  salonId: string;
  customerId: string;
  requestedBy: string;
  requestSource: "owner" | "zalo_privacy_webhook";
  sourceEventId?: string;
};

const CUSTOMER_DELETION_COLLECTION_PAGE_SIZE = 250;
const CUSTOMER_DELETION_COLLECTION_PAGES_PER_ATTEMPT = 2;
const CUSTOMER_DELETION_STORAGE_PAGE_SIZE = 100;
const CUSTOMER_DELETION_STORAGE_PAGES_PER_ATTEMPT = 4;
const CUSTOMER_DELETION_STORAGE_CONCURRENCY = 10;
const CUSTOMER_DELETION_STORAGE_DELETE_ATTEMPTS = 3;

async function runCustomerDeletionJob(input: CustomerDeletionJobInput) {
  const { salonId, customerId, requestedBy, requestSource, sourceEventId } = input;
  await ensureSalonCustomerCount(salonId);

  const customerRef = db.collection("customers").doc(customerId);
  const jobRef = customerDeletionJobRefFor(salonId, customerId);
  const [customerSnap, jobSnap] = await Promise.all([customerRef.get(), jobRef.get()]);
  const existingJob = jobSnap.data() ?? {};

  if (existingJob.status === "completed") {
    return customerDeletionResult(customerId, existingJob);
  }
  if (
    (!customerSnap.exists || customerSnap.data()?.salonId !== salonId) &&
    (!jobSnap.exists || existingJob.salonId !== salonId || existingJob.customerId !== customerId)
  ) {
    throw new HttpsError("not-found", "Không tìm thấy hồ sơ khách trong salon này");
  }

  await jobRef.set(
    {
      salonId,
      customerId,
      kind: "customer_deletion",
      requestedBy: existingJob.requestedBy ?? requestedBy,
      requestSource: existingJob.requestSource ?? requestSource,
      lastRequestedBy: requestedBy,
      lastRequestSource: requestSource,
      sourceEventId: sourceEventId ?? existingJob.sourceEventId ?? null,
      status: "running",
      attempts: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existingJob.createdAt ?? FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const collectionNames = [
    "haircut_records",
    "reward_history",
    "point_requests",
    "chair_sessions",
    "photo_upload_operations",
  ] as const;
  const existingCollectionCursors =
    existingJob.collectionCursors && typeof existingJob.collectionCursors === "object"
      ? (existingJob.collectionCursors as Record<string, unknown>)
      : {};
  const collectionResults = await Promise.all(
    collectionNames.map((collectionName) =>
      deleteCustomerCollectionDocs(
        collectionName,
        salonId,
        customerId,
        typeof existingCollectionCursors[collectionName] === "string"
          ? String(existingCollectionCursors[collectionName])
          : null,
      ),
    ),
  );
  let operationFailed = collectionResults.some((result) => result.failed);
  let remainingDocuments = collectionResults.reduce((total, result) => total + result.remaining, 0);

  const activeSessionRef = activeSessionRefFor(salonId, customerId);
  try {
    await activeSessionRef.delete();
  } catch {
    operationFailed = true;
  }
  try {
    if ((await activeSessionRef.get()).exists) {
      remainingDocuments += 1;
    }
  } catch {
    operationFailed = true;
    remainingDocuments += 1;
  }

  const storageResult = await deleteStoragePrefixStrict(
    `salons/${salonId}/customers/${customerId}/`,
    typeof existingJob.storagePageToken === "string" ? existingJob.storagePageToken : null,
  );
  operationFailed ||= storageResult.failed > 0 || storageResult.listFailed;

  let customerRemaining = customerSnap.exists ? 1 : 0;
  if (
    deletionJobOutcome({
      remainingDocuments,
      remainingStorageFiles: storageResult.remaining,
      failedStorageFiles: storageResult.failed,
      operationFailed,
    }) === "completed"
  ) {
    try {
      const salonRef = db.collection("salons").doc(salonId);
      await db.runTransaction(async (tx) => {
        const [currentCustomer, salonSnap] = await Promise.all([
          tx.get(customerRef),
          tx.get(salonRef),
        ]);
        if (!currentCustomer.exists) {
          return;
        }
        if (!salonSnap.exists || currentCustomer.data()?.salonId !== salonId) {
          throw new Error("customer ownership changed during deletion");
        }
        const customerCount = Math.max(0, Math.floor(Number(salonSnap.data()?.customerCount ?? 1)));
        tx.delete(customerRef);
        tx.set(
          salonRef,
          { customerCount: Math.max(0, customerCount - 1), updatedAt: Timestamp.now() },
          { merge: true },
        );
      });
      customerRemaining = (await customerRef.get()).exists ? 1 : 0;
    } catch {
      operationFailed = true;
      customerRemaining = 1;
    }
  }

  remainingDocuments += customerRemaining;
  const status = deletionJobOutcome({
    remainingDocuments,
    remainingStorageFiles: storageResult.remaining,
    failedStorageFiles: storageResult.failed,
    operationFailed,
  });
  const totals = {
    deletedRecords: Number(existingJob.deletedRecords ?? 0) + collectionResults[0].deleted,
    deletedRewards: Number(existingJob.deletedRewards ?? 0) + collectionResults[1].deleted,
    deletedRequests: Number(existingJob.deletedRequests ?? 0) + collectionResults[2].deleted,
    deletedSessions: Number(existingJob.deletedSessions ?? 0) + collectionResults[3].deleted,
    deletedPhotoOperations:
      Number(existingJob.deletedPhotoOperations ?? 0) + collectionResults[4].deleted,
    deletedStorageFiles: Number(existingJob.deletedStorageFiles ?? 0) + storageResult.deleted,
  };

  await jobRef.set(
    {
      ...totals,
      status,
      remainingDocuments,
      remainingStorageFiles: storageResult.remaining,
      failedStorageFiles: storageResult.failed,
      collectionCursors: Object.fromEntries(
        collectionNames.map((collectionName, index) => [
          collectionName,
          collectionResults[index].nextCursor,
        ]),
      ),
      collectionProgress: Object.fromEntries(
        collectionNames.map((collectionName, index) => [
          collectionName,
          {
            deletedThisAttempt: collectionResults[index].deleted,
            remaining: collectionResults[index].remaining,
            failed: collectionResults[index].failed,
          },
        ]),
      ),
      storagePageToken: storageResult.nextPageToken,
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: status === "completed" ? FieldValue.serverTimestamp() : null,
    },
    { merge: true },
  );

  if (status !== "completed") {
    throw new HttpsError(
      "unavailable",
      "Chưa xóa hết dữ liệu khách. Hãy thử lại để tiếp tục tác vụ an toàn",
    );
  }

  return customerDeletionResult(customerId, { ...totals, status });
}

async function deleteCustomerCollectionDocs(
  collectionName: string,
  salonId: string,
  customerId: string,
  initialCursor: string | null,
): Promise<{
  deleted: number;
  remaining: number;
  failed: boolean;
  nextCursor: string | null;
}> {
  const customerQuery = db
    .collection(collectionName)
    .where("salonId", "==", salonId)
    .where("customerId", "==", customerId)
    .orderBy(FieldPath.documentId());
  let deleted = 0;
  let failed = false;
  let nextCursor = initialCursor;

  for (
    let pageNumber = 0;
    pageNumber < CUSTOMER_DELETION_COLLECTION_PAGES_PER_ATTEMPT;
    pageNumber += 1
  ) {
    try {
      let pageQuery = customerQuery.limit(CUSTOMER_DELETION_COLLECTION_PAGE_SIZE);
      if (nextCursor) {
        pageQuery = pageQuery.startAfter(nextCursor);
      }
      const page = await pageQuery.get();
      if (page.empty) {
        nextCursor = null;
        break;
      }

      const batch = db.batch();
      page.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += page.size;
      nextCursor = page.docs[page.docs.length - 1].id;

      if (page.size < CUSTOMER_DELETION_COLLECTION_PAGE_SIZE) {
        nextCursor = null;
        break;
      }
    } catch {
      failed = true;
      break;
    }
  }

  try {
    const remaining = (await customerQuery.limit(1).get()).empty ? 0 : 1;
    return {
      deleted,
      remaining,
      failed,
      nextCursor: remaining > 0 ? nextCursor : null,
    };
  } catch {
    return { deleted, remaining: 1, failed: true, nextCursor };
  }
}

function customerDeletionResult(customerId: string, data: DocumentData) {
  return {
    customerId,
    status: "completed" as const,
    deletedRecords: Number(data.deletedRecords ?? 0),
    deletedRewards: Number(data.deletedRewards ?? 0),
    deletedRequests: Number(data.deletedRequests ?? 0),
    deletedSessions: Number(data.deletedSessions ?? 0),
    deletedPhotoOperations: Number(data.deletedPhotoOperations ?? 0),
    deletedStorageFiles: Number(data.deletedStorageFiles ?? 0),
  };
}

async function processZaloPrivacyDeletionEvent(
  event: ZaloPrivacyEvent,
  eventId: string,
): Promise<ZaloPrivacyProcessingResult> {
  const eventRef = db.collection("customer_deletion_jobs").doc(eventId);
  let duplicate = false;
  let existingJobCount = 0;

  await db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    const existing = eventSnap.data() ?? {};
    existingJobCount = Math.max(0, Number(existing.jobCount ?? 0));

    if (existing.status === "completed") {
      duplicate = true;
      tx.set(
        eventRef,
        {
          deliveries: FieldValue.increment(1),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      return;
    }

    tx.set(
      eventRef,
      {
        kind: "zalo_privacy_event",
        appId: event.appId,
        eventName: event.eventName,
        zaloTimestamp: event.timestamp,
        status: "running",
        attempts: FieldValue.increment(1),
        deliveries: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
        createdAt: existing.createdAt ?? Timestamp.now(),
      },
      { merge: true },
    );
  });

  if (duplicate) {
    return { duplicate: true, jobCount: existingJobCount };
  }

  try {
    const [eventSnap, customersSnap] = await Promise.all([
      eventRef.get(),
      db.collection("customers").where("zaloUserId", "==", event.userId).get(),
    ]);
    const eventData = eventSnap.data() ?? {};
    const persistedJobIds = Array.isArray(eventData.customerJobIds)
      ? eventData.customerJobIds.filter(
          (value: unknown): value is string => typeof value === "string",
        )
      : [];
    const knownJobIds = new Set<string>(persistedJobIds);

    for (const customerSnap of customersSnap.docs) {
      const salonId = String(customerSnap.data().salonId ?? "").trim();
      if (!salonId) {
        throw new Error("customer_without_salon");
      }
      knownJobIds.add(customerDeletionJobRefFor(salonId, customerSnap.id).id);
    }

    // Persist the deterministic targets before deleting customer documents so retries can resume.
    await eventRef.set(
      {
        customerJobIds: [...knownJobIds],
        jobCount: knownJobIds.size,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    for (const customerSnap of customersSnap.docs) {
      const salonId = String(customerSnap.data().salonId ?? "").trim();
      await runCustomerDeletionJob({
        salonId,
        customerId: customerSnap.id,
        requestedBy: "zalo-privacy-webhook",
        requestSource: "zalo_privacy_webhook",
        sourceEventId: eventId,
      });
    }

    await eventRef.set(
      {
        customerJobIds: [...knownJobIds],
        jobCount: knownJobIds.size,
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { duplicate: false, jobCount: knownJobIds.size };
  } catch {
    await eventRef.set(
      {
        status: "partial",
        failureCode: "deletion_incomplete",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw new Error("zalo_privacy_deletion_incomplete");
  }
}

export const zaloPrivacyWebhook = onRequest(
  {
    ...functionOptions,
    secrets: [zaloOpenApiKey],
    timeoutSeconds: 300,
    concurrency: 20,
    maxInstances: 10,
  },
  async (request, response) => {
    const handler = createZaloPrivacyWebhookHandler({
      miniAppId: String(process.env.ZALO_MINI_APP_ID || "").trim(),
      apiKey: zaloOpenApiKey.value(),
      processEvent: processZaloPrivacyDeletionEvent,
    });
    await handler(request, response);
  },
);

async function backfillOperationalSessions(
  collectionName: "chair_sessions" | "active_service_sessions",
  salonId: string,
  defaultBranchId: string,
  defaultBranchName: string,
): Promise<number> {
  let cursorId = "";
  let updated = 0;

  while (true) {
    let pageQuery = db
      .collection(collectionName)
      .where("salonId", "==", salonId)
      .orderBy(FieldPath.documentId())
      .limit(200);
    if (cursorId) {
      pageQuery = pageQuery.startAfter(cursorId);
    }
    const page = await pageQuery.get();
    if (page.empty) {
      break;
    }

    const customerIds = [
      ...new Set(
        page.docs
          .map((doc) => doc.data().customerId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    ];
    const customerSnaps =
      customerIds.length > 0
        ? await db.getAll(...customerIds.map((id) => db.collection("customers").doc(id)))
        : [];
    const customers = new Map(customerSnaps.map((snap) => [snap.id, snap.data() ?? {}]));
    const batch = db.batch();
    let writes = 0;

    page.docs.forEach((doc) => {
      const data = doc.data();
      const patch: Record<string, unknown> = {};
      const status = String(data.status || "waiting");
      const isOpen = OPEN_SESSION_STATUSES.includes(
        status as (typeof OPEN_SESSION_STATUSES)[number],
      );

      Object.assign(
        patch,
        legacyBranchPatch({
          currentBranchId: data.branchId,
          defaultBranchId,
          defaultBranchName,
        }) ?? {},
      );
      if (typeof data.isOpen !== "boolean") {
        patch.isOpen = isOpen;
      }
      if (isOpen && !timestampMillis(data.expiresAt)) {
        const createdAtMs = timestampMillis(data.createdAt) ?? 0;
        patch.expiresAt = Timestamp.fromMillis(
          serviceSessionExpiresAtMs(createdAtMs, SESSION_POINT_REQUEST_WINDOW_MS),
        );
      }
      if (!data.customerSummary) {
        const customer = customers.get(String(data.customerId || "")) ?? {};
        patch.customerSummary = {
          name: String(customer.name || "Khách hàng"),
          phoneLast4: String(customer.phoneLast4 || ""),
          points: Math.max(0, Number(customer.points ?? 0)),
          allowPhoto: Boolean(customer.allowPhoto),
        };
      }
      if (collectionName === "chair_sessions") {
        if (data.zaloUserId !== undefined) {
          patch.zaloUserId = FieldValue.delete();
        }
        if (data.qrToken !== undefined) {
          patch.qrToken = FieldValue.delete();
        }
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Timestamp.now();
        batch.set(doc.ref, patch, { merge: true });
        writes += 1;
      }
    });

    if (writes > 0) {
      await batch.commit();
      updated += writes;
    }
    cursorId = page.docs[page.docs.length - 1].id;
    if (page.size < 200) {
      break;
    }
  }

  return updated;
}

async function backfillSalonCollection(
  collectionName: string,
  salonId: string,
  patchFor: (data: DocumentData) => Record<string, unknown> | null,
): Promise<number> {
  let cursorId = "";
  let updated = 0;

  while (true) {
    let pageQuery = db
      .collection(collectionName)
      .where("salonId", "==", salonId)
      .orderBy(FieldPath.documentId())
      .limit(300);
    if (cursorId) {
      pageQuery = pageQuery.startAfter(cursorId);
    }
    const page = await pageQuery.get();
    if (page.empty) {
      break;
    }

    const batch = db.batch();
    let writes = 0;
    page.docs.forEach((doc) => {
      const patch = patchFor(doc.data());
      if (patch) {
        batch.set(doc.ref, patch, { merge: true });
        writes += 1;
      }
    });
    if (writes > 0) {
      await batch.commit();
      updated += writes;
    }

    cursorId = page.docs[page.docs.length - 1].id;
    if (page.size < 300) {
      break;
    }
  }

  return updated;
}

type DeletableStorageFile = {
  delete(): Promise<unknown>;
};

function storageDeleteErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }
  return String((error as { code?: unknown }).code ?? "").toUpperCase();
}

function isStorageObjectAlreadyDeleted(error: unknown) {
  const code = storageDeleteErrorCode(error);
  return code === "404" || code === "NOT_FOUND";
}

function isRetryableStorageDeleteError(error: unknown) {
  const code = storageDeleteErrorCode(error);
  return [
    "408",
    "409",
    "429",
    "500",
    "502",
    "503",
    "504",
    "ETIMEDOUT",
    "ECONNRESET",
    "EAI_AGAIN",
  ].includes(code);
}

async function deleteStorageFileWithRetry(file: DeletableStorageFile) {
  for (let attempt = 1; attempt <= CUSTOMER_DELETION_STORAGE_DELETE_ATTEMPTS; attempt += 1) {
    try {
      await file.delete();
      return true;
    } catch (error) {
      if (isStorageObjectAlreadyDeleted(error)) {
        return true;
      }
      if (
        attempt === CUSTOMER_DELETION_STORAGE_DELETE_ATTEMPTS ||
        !isRetryableStorageDeleteError(error)
      ) {
        return false;
      }
    }
  }
  return false;
}

async function deleteStoragePrefixStrict(
  prefix: string,
  initialPageToken: string | null,
): Promise<{
  deleted: number;
  failed: number;
  remaining: number;
  listFailed: boolean;
  nextPageToken: string | null;
}> {
  const bucket = storage.bucket();
  let pageToken = initialPageToken;
  let deleted = 0;
  let failed = 0;
  let listFailed = false;

  for (
    let pageNumber = 0;
    pageNumber < CUSTOMER_DELETION_STORAGE_PAGES_PER_ATTEMPT;
    pageNumber += 1
  ) {
    let files;
    let nextQuery;
    try {
      [files, nextQuery] = await bucket.getFiles({
        prefix,
        autoPaginate: false,
        maxResults: CUSTOMER_DELETION_STORAGE_PAGE_SIZE,
        pageToken: pageToken ?? undefined,
      });
    } catch {
      listFailed = true;
      pageToken = null;
      break;
    }

    let pageFailed = 0;
    for (let start = 0; start < files.length; start += CUSTOMER_DELETION_STORAGE_CONCURRENCY) {
      const fileGroup = files.slice(start, start + CUSTOMER_DELETION_STORAGE_CONCURRENCY);
      const groupResults = await Promise.all(
        fileGroup.map((file) => deleteStorageFileWithRetry(file)),
      );
      const groupDeleted = groupResults.filter(Boolean).length;
      deleted += groupDeleted;
      pageFailed += groupResults.length - groupDeleted;
    }
    failed += pageFailed;
    if (pageFailed > 0) {
      pageToken = null;
      break;
    }

    pageToken =
      nextQuery && typeof nextQuery.pageToken === "string" && nextQuery.pageToken
        ? nextQuery.pageToken
        : null;
    if (!pageToken) {
      break;
    }
  }

  try {
    const [remainingFiles] = await bucket.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: 1,
    });
    const remaining = remainingFiles.length > 0 ? 1 : 0;
    return {
      deleted,
      failed,
      remaining,
      listFailed,
      nextPageToken: remaining > 0 && failed === 0 && !listFailed ? pageToken : null,
    };
  } catch {
    return {
      deleted,
      failed,
      remaining: 1,
      listFailed: true,
      nextPageToken: null,
    };
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

  const branchId = await resolveAuthorizedBranchScope(user, salonId, request.data?.branchId);
  let rewardQuery = db
    .collection("reward_history")
    .where("salonId", "==", salonId)
    .where("rewardCode", "==", rewardCodeInput);
  if (branchId) {
    rewardQuery = rewardQuery.where("branchId", "==", branchId);
  }
  const query = await rewardQuery.limit(1).get();

  if (query.empty) {
    return {
      found: false,
      rewardCode: rewardCodeInput,
      status: "not_found",
    };
  }

  const doc = query.docs[0];
  const reward = doc.data();
  const status = effectiveRewardStatus(
    reward.status,
    timestampMillis(reward.expiresAt),
    Date.now(),
  );
  let customerName = "";

  if (reward.customerId) {
    const customerSnap = await db.collection("customers").doc(String(reward.customerId)).get();
    if (customerSnap.exists && customerSnap.data()?.salonId === salonId) {
      customerName = String(customerSnap.data()?.name ?? "");
    }
  }

  return {
    found: true,
    rewardId: doc.id,
    rewardCode: reward.rewardCode ?? rewardCodeInput,
    rewardName: reward.rewardName ?? "",
    status,
    customerName,
    createdAtMs: timestampMillis(reward.createdAt),
    usedAtMs: timestampMillis(reward.usedAt),
    expiresAtMs: timestampMillis(reward.expiresAt),
  };
});

export const redeemRewardCode = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const rewardCodeInput = requireString(request.data?.rewardCode, "rewardCode");
  const idempotencyKey = requireIdempotencyKey(request.data?.idempotencyKey);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  await enforceAuthenticatedRateLimit("redeemRewardCode", uid, salonId);
  await assertFeatureEnabled(
    salonId,
    "rewardRedeemEnabled",
    "Tính năng đổi quà đang tạm ngừng.",
    request.data?.appVersion,
  );

  if (user.role === "staff" && user.canRedeemRewards !== true) {
    throw new HttpsError("permission-denied", "Nhân viên chưa được phép xác nhận mã quà");
  }

  const branchId = await resolveAuthorizedBranchScope(user, salonId, request.data?.branchId);
  let rewardQuery = db
    .collection("reward_history")
    .where("salonId", "==", salonId)
    .where("rewardCode", "==", rewardCodeInput);
  if (branchId) {
    rewardQuery = rewardQuery.where("branchId", "==", branchId);
  }
  const query = await rewardQuery.limit(1).get();

  if (query.empty) {
    throw new HttpsError("not-found", "Không tìm thấy mã quà");
  }

  const rewardRef = query.docs[0].ref;
  const rewardBeforeTransaction = query.docs[0].data();
  const usedBranchId = branchId || String(rewardBeforeTransaction.branchId || "");
  if (!usedBranchId) {
    throw apiError(
      "failed-precondition",
      ApiErrorCode.INVALID_BRANCH,
      "Chưa xác định được chi nhánh đổi quà",
    );
  }
  await assertBranchAccess(user, usedBranchId);
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const customerId = String(rewardBeforeTransaction.customerId || "");
    const [rewardSnap, branchSnap, customerSnap] = await Promise.all([
      tx.get(rewardRef),
      tx.get(db.collection("branches").doc(usedBranchId)),
      tx.get(db.collection("customers").doc(customerId)),
    ]);
    const reward = rewardSnap.data();

    if (!rewardSnap.exists || reward?.salonId !== salonId || reward?.branchId !== usedBranchId) {
      throw new HttpsError("not-found", "Không tìm thấy mã quà");
    }
    assertBranchIsOperational(branchSnap.data(), salonId, usedBranchId);
    if (
      !customerId ||
      reward.customerId !== customerId ||
      !customerSnap.exists ||
      customerSnap.data()?.salonId !== salonId
    ) {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_REQUEST,
        "Mã quà không còn gắn với khách hợp lệ",
      );
    }
    if (
      reward?.status === "used" &&
      reward?.redemptionIdempotencyKey === idempotencyKey &&
      reward?.usedBy === uid
    ) {
      return {
        rewardId: rewardSnap.id,
        rewardCode: reward.rewardCode ?? rewardCodeInput,
        rewardName: reward.rewardName ?? "",
        customerId: reward.customerId ?? "",
        alreadyRedeemed: true,
      };
    }
    const rewardStatus = effectiveRewardStatus(
      reward.status,
      timestampMillis(reward.expiresAt),
      now.toMillis(),
    );
    if (rewardStatus === "expired") {
      throw apiError("failed-precondition", ApiErrorCode.REWARD_EXPIRED, "Mã quà đã hết hạn");
    }
    if (rewardStatus !== "unused") {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.REWARD_ALREADY_REDEEMED,
        rewardStatus === "revoked" ? "Mã quà đã bị hủy" : "Mã quà đã được xử lý",
      );
    }

    tx.set(
      rewardRef,
      {
        status: "used",
        usedAt: now,
        usedBy: uid,
        usedBranchId,
        redemptionIdempotencyKey: idempotencyKey,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        branchId: usedBranchId,
        actorId: uid,
        actorRole: user.role,
        action: "reward.redeemed",
        targetType: "reward",
        targetId: rewardSnap.id,
        before: { status: rewardStatus },
        after: { status: "used", usedBranchId },
        createdAt: now,
      }),
    );

    return {
      rewardId: rewardSnap.id,
      rewardCode: reward.rewardCode ?? rewardCodeInput,
      rewardName: reward.rewardName ?? "",
      customerId: reward.customerId ?? "",
      alreadyRedeemed: false,
    };
  });

  let customerName = "";
  if (result.customerId) {
    const customerSnap = await db.collection("customers").doc(String(result.customerId)).get();
    if (customerSnap.exists && customerSnap.data()?.salonId === salonId) {
      customerName = String(customerSnap.data()?.name ?? "");
    }
  }

  return {
    rewardId: result.rewardId,
    rewardCode: result.rewardCode,
    rewardName: result.rewardName,
    customerName,
    alreadyRedeemed: result.alreadyRedeemed,
  };
});

export const restoreRewardCode = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = requireString(request.data?.salonId, "salonId");
  const rewardCodeInput = requireString(request.data?.rewardCode, "rewardCode");
  const reason = optionalLimitedString(request.data?.reason, "reason", 200) ?? "Bấm nhầm";
  await assertSalonRole(uid, salonId, ["owner"]);

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
  await db.runTransaction(async (tx) => {
    const rewardSnap = await tx.get(rewardRef);
    const reward = rewardSnap.data() ?? {};
    if (
      !rewardSnap.exists ||
      reward.salonId !== salonId ||
      !canRestoreReward({
        status: reward.status,
        usedAtMs: timestampMillis(reward.usedAt),
        expiresAtMs: timestampMillis(reward.expiresAt),
        nowMs: now.toMillis(),
        restoreWindowMs: REWARD_RESTORE_WINDOW_MS,
      })
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Chỉ có thể hoàn tác mã vừa xác nhận trong vòng 15 phút",
      );
    }

    tx.set(
      rewardRef,
      {
        status: "unused",
        usedAt: FieldValue.delete(),
        usedBy: FieldValue.delete(),
        usedBranchId: FieldValue.delete(),
        redemptionIdempotencyKey: FieldValue.delete(),
        restoredAt: now,
        restoredBy: uid,
        restoreReason: reason,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "reward.redemption_restored",
        targetType: "reward",
        targetId: rewardSnap.id,
        before: { status: "used" },
        after: { status: "unused", reason },
        createdAt: now,
      }),
    );
  });

  return { rewardCode: rewardCodeInput, status: "unused" as const };
});

export const requestPersonalAccountDeletion = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  assertRecentAuthentication(request.auth);
  const user = await getAppUser(uid);
  await enforceAuthenticatedRateLimit("adminMutation", uid, user.salonId);
  if (user.role === "owner") {
    throw new HttpsError(
      "failed-precondition",
      "Chủ salon cần dùng mục Xóa salon để xử lý cả tài khoản và dữ liệu salon",
      { errorCode: "OWNER_MUST_DELETE_SALON" },
    );
  }

  const now = Timestamp.now();
  const userRef = db.collection("users").doc(uid);
  const tokenSnap = await db.collection("device_tokens").where("uid", "==", uid).get();
  const batch = db.batch();
  batch.set(
    userRef,
    {
      name: "Tài khoản đã xóa",
      phone: FieldValue.delete(),
      email: FieldValue.delete(),
      avatarUrl: FieldValue.delete(),
      isActive: false,
      deletionStatus: "completed",
      deletedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  tokenSnap.docs.forEach((tokenDoc) => batch.delete(tokenDoc.ref));
  batch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId: user.salonId,
      actorId: uid,
      action: "account.deleted",
      targetType: "user",
      targetId: uid,
      before: { isActive: true },
      after: { isActive: false, deletionStatus: "completed" },
      createdAt: now,
    }),
  );
  await batch.commit();
  await getAuth().deleteUser(uid);

  return { status: "completed" as const };
});

export const requestSalonDeletion = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  assertRecentAuthentication(request.auth);
  const salonId = limitedString(request.data?.salonId, "salonId", 128);
  const confirmedSalonName = limitedString(request.data?.salonName, "salonName", 120);
  await assertSalonRoleIncludingInactiveSalon(uid, salonId, ["owner"]);
  await enforceAuthenticatedRateLimit("adminMutation", uid, salonId);
  const salonRef = db.collection("salons").doc(salonId);
  const jobRef = db.collection("salon_deletion_jobs").doc(salonId);
  const now = Timestamp.now();
  const executeAfter = Timestamp.fromMillis(now.toMillis() + 14 * 24 * 60 * 60 * 1000);

  const result = await db.runTransaction(async (tx) => {
    const [salonSnap, jobSnap] = await Promise.all([tx.get(salonRef), tx.get(jobRef)]);
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
    const actualName = String(salonSnap.data()?.name || "").trim();
    if (actualName.localeCompare(confirmedSalonName.trim(), "vi", { sensitivity: "base" }) !== 0) {
      throw new HttpsError("invalid-argument", "Tên salon xác nhận chưa đúng");
    }
    if (jobSnap.data()?.status === "requested" || jobSnap.data()?.status === "pending") {
      return {
        status: "requested" as const,
        executeAfterMs: timestampMillis(jobSnap.data()?.executeAfter) ?? executeAfter.toMillis(),
        alreadyRequested: true,
      };
    }
    tx.set(
      salonRef,
      {
        status: "pending_deletion",
        isActive: false,
        deletionRequestedAt: now,
        deletionRequestedBy: uid,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(jobRef, {
      salonId,
      status: "requested",
      requestedBy: uid,
      requestedAt: now,
      executeAfter,
      updatedAt: now,
    });
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "salon.deletion_requested",
        targetType: "salon",
        targetId: salonId,
        before: { status: salonStatus(salonSnap.data()) },
        after: { status: "pending_deletion", executeAfterMs: executeAfter.toMillis() },
        createdAt: now,
      }),
    );
    return {
      status: "requested" as const,
      executeAfterMs: executeAfter.toMillis(),
      alreadyRequested: false,
    };
  });

  return result;
});

export const cancelSalonDeletion = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  assertRecentAuthentication(request.auth);
  const salonId = limitedString(request.data?.salonId, "salonId", 128);
  await assertSalonRoleIncludingInactiveSalon(uid, salonId, ["owner"]);
  await enforceAuthenticatedRateLimit("adminMutation", uid, salonId);
  const salonRef = db.collection("salons").doc(salonId);
  const jobRef = db.collection("salon_deletion_jobs").doc(salonId);
  const now = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const [salonSnap, jobSnap] = await Promise.all([tx.get(salonRef), tx.get(jobRef)]);
    if (!salonSnap.exists || !jobSnap.exists || jobSnap.data()?.status !== "requested") {
      throw new HttpsError("failed-precondition", "Không có yêu cầu xóa salon đang chờ");
    }
    const leaseUntilMs = timestampMillis(jobSnap.data()?.leaseUntil) ?? 0;
    if (leaseUntilMs > now.toMillis()) {
      throw new HttpsError("failed-precondition", "Hệ thống đã bắt đầu xóa và không thể hủy");
    }
    tx.set(
      salonRef,
      {
        status: "active",
        isActive: true,
        deletionRequestedAt: FieldValue.delete(),
        deletionRequestedBy: FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      jobRef,
      { status: "cancelled", cancelledAt: now, cancelledBy: uid, updatedAt: now },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "salon.deletion_cancelled",
        targetType: "salon",
        targetId: salonId,
        before: { status: "pending_deletion" },
        after: { status: "active" },
        createdAt: now,
      }),
    );
  });

  return { status: "cancelled" as const };
});

export const getSalonDeletionStatus = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = limitedString(request.data?.salonId, "salonId", 128);
  await assertSalonRoleIncludingInactiveSalon(uid, salonId, ["owner"]);
  const jobSnap = await db.collection("salon_deletion_jobs").doc(salonId).get();
  if (!jobSnap.exists) {
    return { status: "none" as const, executeAfterMs: null };
  }
  return {
    status: String(jobSnap.data()?.status || "none"),
    executeAfterMs: timestampMillis(jobSnap.data()?.executeAfter),
  };
});

export const registerManagerDeviceToken = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const salonId = limitedString(request.data?.salonId, "salonId", 128);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  assertSupportedAppVersion(await getSystemFeatures(salonId), request.data?.appVersion);
  const parsed = DeviceTokenSchema.safeParse({
    uid,
    salonId,
    platform: request.data?.platform,
    token: request.data?.token,
    appVersion: request.data?.appVersion ?? "",
    isActive: true,
  });
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Thông tin thiết bị nhận thông báo không hợp lệ");
  }
  const tokenRef = db.collection("device_tokens").doc(deviceTokenId(parsed.data.token));
  const tokenSnap = await tokenRef.get();
  const now = Timestamp.now();
  await tokenRef.set(
    {
      ...parsed.data,
      role: user.role,
      branchIds:
        user.role === "owner"
          ? []
          : [
              ...new Set(
                [...(Array.isArray(user.branchIds) ? user.branchIds : []), user.branchId].filter(
                  (branchId): branchId is string =>
                    typeof branchId === "string" && branchId.length > 0,
                ),
              ),
            ],
      createdAt: tokenSnap.exists ? (tokenSnap.data()?.createdAt ?? now) : now,
      updatedAt: now,
    },
    { merge: true },
  );
  return { registered: true };
});

export const unregisterManagerDeviceToken = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  const token = limitedString(request.data?.token, "token", 4096);
  const tokenRef = db.collection("device_tokens").doc(deviceTokenId(token));
  const tokenSnap = await tokenRef.get();
  if (tokenSnap.exists && tokenSnap.data()?.uid !== uid) {
    throw new HttpsError("permission-denied", "Thiết bị không thuộc tài khoản này");
  }
  if (tokenSnap.exists) {
    await tokenRef.set(
      { isActive: false, disabledReason: "signed_out", updatedAt: Timestamp.now() },
      { merge: true },
    );
  }
  return { unregistered: true };
});

export const getSystemAdminOverview = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);

  const [
    salonsCount,
    suspendedCount,
    pendingDeletionCount,
    ownersCount,
    staffCount,
    pendingPointsCount,
    openSessionsCount,
  ] = await Promise.all([
    db.collection("salons").count().get(),
    db.collection("salons").where("status", "==", "suspended").count().get(),
    db.collection("salons").where("status", "==", "pending_deletion").count().get(),
    db.collection("users").where("role", "==", "owner").count().get(),
    db.collection("users").where("role", "==", "staff").count().get(),
    db.collection("point_requests").where("status", "==", "pending").count().get(),
    db.collection("chair_sessions").where("isOpen", "==", true).count().get(),
  ]);
  const totalSalons = salonsCount.data().count;
  const suspendedSalons = suspendedCount.data().count;
  const pendingDeletionSalons = pendingDeletionCount.data().count;

  return {
    salons: {
      total: totalSalons,
      active: Math.max(0, totalSalons - suspendedSalons - pendingDeletionSalons),
      suspended: suspendedSalons,
      pendingDeletion: pendingDeletionSalons,
    },
    users: {
      owners: ownersCount.data().count,
      staff: staffCount.data().count,
    },
    operations: {
      pendingPointRequests: pendingPointsCount.data().count,
      openSessions: openSessionsCount.data().count,
    },
  };
});

export const listSystemAdminSalons = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  const pageSize = Math.min(Math.max(Number(request.data?.pageSize ?? 30), 10), 100);
  const cursor = optionalString(request.data?.cursor);
  let salonsQuery = db
    .collection("salons")
    .orderBy(FieldPath.documentId())
    .limit(Math.floor(pageSize));

  if (cursor) {
    const cursorSnap = await db.collection("salons").doc(cursor).get();
    if (cursorSnap.exists) {
      salonsQuery = salonsQuery.startAfter(cursorSnap);
    }
  }

  const salonsSnap = await salonsQuery.get();
  return {
    salons: salonsSnap.docs.map((salonDoc) => {
      const data = salonDoc.data();
      return {
        id: salonDoc.id,
        name: String(data.name || "Salon"),
        status: salonStatus(data),
        plan: String(data.plan || "free"),
        customerCount: Math.max(0, Number(data.customerCount ?? 0)),
        ownerId: String(data.ownerId || ""),
        updatedAtMs: timestampMillis(data.updatedAt),
      };
    }),
    nextCursor:
      salonsSnap.size === Math.floor(pageSize)
        ? (salonsSnap.docs[salonsSnap.docs.length - 1]?.id ?? null)
        : null,
  };
});

export const updateSystemAdminSalonStatus = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  assertAdminWriteOperationsEnabled();
  const salonId = limitedString(request.data?.salonId, "salonId", 128);
  await enforceAuthenticatedRateLimit("adminMutation", uid, salonId);
  const statusResult = SalonStatusSchema.safeParse(request.data?.status);
  if (!statusResult.success) {
    throw new HttpsError("invalid-argument", "Trạng thái salon không hợp lệ");
  }
  const status = statusResult.data;
  const reason = optionalLimitedString(request.data?.reason, "reason", 300) ?? "";
  if (status !== "active" && !reason) {
    throw new HttpsError("invalid-argument", "Cần nhập lý do khi khóa hoặc chờ xóa salon");
  }

  const salonRef = db.collection("salons").doc(salonId);
  const now = Timestamp.now();
  const previousStatus = await db.runTransaction(async (tx) => {
    const salonSnap = await tx.get(salonRef);
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
    const before = salonStatus(salonSnap.data());
    if (before === status) {
      return before;
    }
    tx.set(
      salonRef,
      {
        status,
        isActive: status === "active",
        statusReason: reason || FieldValue.delete(),
        statusUpdatedAt: now,
        statusUpdatedBy: uid,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: status === "active" ? "admin.salon_reactivated" : "admin.salon_suspended",
        targetType: "salon",
        targetId: salonId,
        before: { status: before },
        after: { status, reason },
        createdAt: now,
      }),
    );
    return before;
  });

  return { salonId, previousStatus, status };
});

export const updateSystemFeatureFlags = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  assertAdminWriteOperationsEnabled();
  const targetSalonId = optionalLimitedString(request.data?.salonId, "salonId", 128);
  await enforceAuthenticatedRateLimit("adminMutation", uid, targetSalonId || "__system__");
  const patch = parseFeaturePatch(request.data?.features);
  const now = Timestamp.now();
  const featureRef = targetSalonId
    ? db.collection("salons").doc(targetSalonId).collection("settings").doc("features")
    : db.collection("system_config").doc("features");

  if (targetSalonId) {
    const salonSnap = await db.collection("salons").doc(targetSalonId).get();
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
  }

  const before = targetSalonId
    ? await getSystemFeatures(targetSalonId)
    : normalizeSystemFeatures((await featureRef.get()).data());
  const parsed = SystemFeaturesSchema.safeParse({ ...before, ...patch });
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Cấu hình tính năng không hợp lệ");
  }
  const next = parsed.data;
  const batch = db.batch();
  batch.set(
    featureRef,
    {
      ...(targetSalonId ? patch : next),
      updatedAt: now,
      updatedBy: uid,
    },
    { merge: true },
  );
  batch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId: targetSalonId || "__system__",
      actorId: uid,
      action: "admin.feature_flag_updated",
      targetType: "feature_flags",
      targetId: targetSalonId || "global",
      before,
      after: next,
      createdAt: now,
    }),
  );
  await batch.commit();

  return { salonId: targetSalonId ?? null, features: next };
});

export const getSystemFeatureFlags = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  const salonId = optionalLimitedString(request.data?.salonId, "salonId", 128);
  if (salonId) {
    const salonSnap = await db.collection("salons").doc(salonId).get();
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy salon");
    }
  }
  return {
    salonId: salonId ?? null,
    features: salonId
      ? await getSystemFeatures(salonId)
      : normalizeSystemFeatures(
          (await db.collection("system_config").doc("features").get()).data(),
        ),
  };
});

export const updateSystemAdminUserStatus = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  assertAdminWriteOperationsEnabled();
  const targetUid = limitedString(request.data?.uid, "uid", 128);
  await enforceAuthenticatedRateLimit("adminMutation", uid, "__system__");
  const isActive = requireBoolean(request.data?.isActive, "isActive");
  const reason = optionalLimitedString(request.data?.reason, "reason", 300) ?? "";
  if (!isActive && !reason) {
    throw new HttpsError("invalid-argument", "Cần nhập lý do khóa tài khoản");
  }

  const userRef = db.collection("users").doc(targetUid);
  const userSnap = await userRef.get();
  const target = userSnap.data();
  if (
    !userSnap.exists ||
    (target?.role !== "owner" && target?.role !== "staff") ||
    typeof target?.salonId !== "string"
  ) {
    throw new HttpsError("not-found", "Không tìm thấy tài khoản owner/staff");
  }

  await getAuth().updateUser(targetUid, { disabled: !isActive });
  await getAuth().revokeRefreshTokens(targetUid);
  const now = Timestamp.now();
  const batch = db.batch();
  batch.set(
    userRef,
    { isActive, statusReason: reason || FieldValue.delete(), updatedAt: now },
    { merge: true },
  );
  batch.set(
    db.collection("audit_events").doc(),
    auditEventData({
      salonId: target.salonId,
      actorId: uid,
      action: isActive ? "admin.user_reactivated" : "admin.user_disabled",
      targetType: "user",
      targetId: targetUid,
      before: { isActive: target.isActive === true },
      after: { isActive, reason },
      createdAt: now,
    }),
  );
  await batch.commit();

  return { uid: targetUid, isActive };
});

export const cancelSessionAsSystemAdmin = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  assertAdminWriteOperationsEnabled();
  const sessionId = limitedString(request.data?.sessionId, "sessionId", 128);
  await enforceAuthenticatedRateLimit("adminMutation", uid, "__system__");
  const reason = limitedString(request.data?.reason, "reason", 300);
  const sessionRef = db.collection("chair_sessions").doc(sessionId);
  const now = Timestamp.now();
  let alreadyCancelled = false;

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError("not-found", "Không tìm thấy lượt cắt");
    }
    const session = sessionSnap.data() ?? {};
    const salonId = String(session.salonId || "");
    const customerId = String(session.customerId || "");
    if (!salonId || !customerId) {
      throw new HttpsError("failed-precondition", "Lượt cắt thiếu tenant hoặc khách hàng");
    }
    if (session.status === "cancelled") {
      alreadyCancelled = true;
      return;
    }
    if (session.status === "completed") {
      throw new HttpsError("failed-precondition", "Không thể hủy lượt đã hoàn tất");
    }
    const activeRef = activeSessionRefFor(salonId, customerId);
    const activeSnap = await tx.get(activeRef);
    tx.set(
      sessionRef,
      {
        status: "cancelled",
        isOpen: false,
        cancellationReason: "admin",
        cancellationNote: reason,
        cancelledAt: now,
        cancelledBy: uid,
        updatedAt: now,
      },
      { merge: true },
    );
    if (activeSnap.exists && activeSnap.data()?.sessionId === sessionId) {
      tx.delete(activeRef);
    }
    tx.set(
      db.collection("audit_events").doc(),
      auditEventData({
        salonId,
        actorId: uid,
        action: "admin.session_cancelled",
        targetType: "chair_session",
        targetId: sessionId,
        before: { status: session.status ?? null },
        after: { status: "cancelled", reason },
        createdAt: now,
      }),
    );
  });

  return { sessionId, status: "cancelled" as const, alreadyCancelled };
});

export const listSystemAdminAuditEvents = onCall(functionOptions, async (request) => {
  const uid = currentUid(request.auth);
  await assertSystemAdmin(uid);
  const salonId = optionalLimitedString(request.data?.salonId, "salonId", 128);
  const pageSize = Math.min(Math.max(Math.floor(Number(request.data?.pageSize ?? 30)), 10), 100);
  const snapshot = await db
    .collection("audit_events")
    .orderBy("createdAt", "desc")
    .limit(salonId ? Math.min(pageSize * 4, 300) : pageSize)
    .get();
  const events = snapshot.docs
    .filter((eventDoc) => !salonId || eventDoc.data().salonId === salonId)
    .slice(0, pageSize)
    .map((eventDoc) => {
      const event = eventDoc.data();
      return {
        id: eventDoc.id,
        salonId: String(event.salonId || ""),
        actorId: String(event.actorId || ""),
        action: String(event.action || ""),
        targetType: String(event.targetType || ""),
        targetId: String(event.targetId || ""),
        createdAtMs: timestampMillis(event.createdAt),
      };
    });
  return { events };
});

async function deleteSalonCollection(collectionName: string, salonId: string) {
  let deleted = 0;
  while (true) {
    const snapshot = await db
      .collection(collectionName)
      .where("salonId", "==", salonId)
      .limit(400)
      .get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
  return deleted;
}

async function deleteSalonFirestoreData(salonId: string) {
  const collections = [
    "active_service_sessions",
    "branches",
    "chair_sessions",
    "customer_deletion_jobs",
    "customers",
    "device_tokens",
    "haircut_records",
    "idempotency_keys",
    "mirrors",
    "point_requests",
    "reward_history",
    "staff_daily_point_awards",
    "support_requests",
    "users",
  ];
  let deletedDocuments = 0;
  for (const collectionName of collections) {
    deletedDocuments += await deleteSalonCollection(collectionName, salonId);
  }

  const settingsSnap = await db.collection("salons").doc(salonId).collection("settings").get();
  if (!settingsSnap.empty) {
    const settingsBatch = db.batch();
    settingsSnap.docs.forEach((document) => settingsBatch.delete(document.ref));
    await settingsBatch.commit();
    deletedDocuments += settingsSnap.size;
  }
  const cleanupBatch = db.batch();
  cleanupBatch.delete(db.collection("lucky_wheel").doc(salonId));
  cleanupBatch.delete(
    db
      .collection("_customer_search_migrations")
      .doc(createHash("sha256").update(`name-prefixes-v1:${salonId}`).digest("hex")),
  );
  await cleanupBatch.commit();
  return deletedDocuments + 2;
}

function salonDeletionAdapter(salonId: string, jobRef: DocumentReference): SalonDeletionAdapter {
  return {
    async loadJob() {
      const snapshot = await jobRef.get();
      if (!snapshot.exists) throw new Error("deletion_job_not_found");
      return snapshot.data() as SalonDeletionJobState;
    },
    async updateJob(patch) {
      await jobRef.set(salonDeletionJobUpdate(patch), { merge: true });
    },
    async collectAuthUids() {
      const users = await db.collection("users").where("salonId", "==", salonId).get();
      return users.docs.map((document) => document.id);
    },
    async deleteAuthUser(uid) {
      await getAuth().deleteUser(uid);
    },
    async deleteFirestoreData() {
      return deleteSalonFirestoreData(salonId);
    },
    async deleteStorageData() {
      await storage.bucket().deleteFiles({ prefix: `salons/${salonId}/`, force: true });
    },
    async deleteSalonDocument() {
      await db.collection("salons").doc(salonId).delete();
    },
    async writeAudit(action, metadata) {
      await writeSalonDeletionAudit(salonId, action, metadata);
    },
  };
}

function salonDeletionJobUpdate(patch: SalonDeletionJobPatch) {
  const { retryAfterMs, completedAt, ...fields } = patch;
  const update: Record<string, unknown> = {
    ...fields,
    updatedAt: Timestamp.now(),
  };
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) update[key] = FieldValue.delete();
  }
  if (typeof retryAfterMs === "number") {
    update.executeAfter = Timestamp.fromMillis(Date.now() + retryAfterMs);
    update.lastFailedAt = Timestamp.now();
  }
  if (completedAt) {
    update.completedAt = Timestamp.now();
    update.leaseUntil = FieldValue.delete();
    update.lastFailedAt = FieldValue.delete();
  }
  return update;
}

async function writeSalonDeletionAudit(
  salonId: string,
  action: SalonDeletionAuditAction,
  metadata?: Record<string, unknown>,
) {
  const discriminator = String(metadata?.accountRef || metadata?.phase || "job");
  const eventId = createHash("sha256")
    .update(`${salonId}:${action}:${discriminator}`)
    .digest("hex");
  await db
    .collection("audit_events")
    .doc(eventId)
    .set(
      auditEventData({
        salonId,
        actorId: "system",
        actorRole: "system",
        action,
        targetType: "salon_deletion_job",
        targetId: salonId,
        metadata,
      }),
      { merge: true },
    );
}

export const processSalonDeletionJobs = onSchedule(
  {
    region: "asia-southeast1",
    schedule: "every 60 minutes",
    timeZone: "Asia/Bangkok",
    timeoutSeconds: 540,
    maxInstances: 1,
  },
  async () => {
    const now = Timestamp.now();
    const jobsSnap = await db
      .collection("salon_deletion_jobs")
      .where("status", "in", [
        "requested",
        "pending",
        "collecting_accounts",
        "deleting_auth_accounts",
        "deleting_firestore_data",
        "deleting_storage_data",
        "failed",
      ] satisfies SalonDeletionStatus[])
      .where("executeAfter", "<=", now)
      .limit(3)
      .get();

    for (const candidate of jobsSnap.docs) {
      const acquired = await db.runTransaction(async (tx) => {
        const current = await tx.get(candidate.ref);
        const leaseUntilMs = timestampMillis(current.data()?.leaseUntil) ?? 0;
        const status = String(current.data()?.status || "");
        const retryableStatuses: SalonDeletionStatus[] = [
          "requested",
          "pending",
          "collecting_accounts",
          "deleting_auth_accounts",
          "deleting_firestore_data",
          "deleting_storage_data",
          "failed",
        ];
        if (
          !current.exists ||
          !retryableStatuses.includes(status as SalonDeletionStatus) ||
          (timestampMillis(current.data()?.executeAfter) ?? Number.POSITIVE_INFINITY) >
            now.toMillis() ||
          leaseUntilMs > now.toMillis()
        ) {
          return false;
        }
        tx.set(
          candidate.ref,
          {
            leaseUntil: Timestamp.fromMillis(now.toMillis() + 10 * 60 * 1000),
            processingStartedAt: now,
            updatedAt: now,
          },
          { merge: true },
        );
        return true;
      });
      if (!acquired) continue;

      const salonId = String(candidate.data().salonId || candidate.id);
      try {
        await runSalonDeletionJob(salonDeletionAdapter(salonId, candidate.ref));
      } catch (error) {
        await candidate.ref.set(
          {
            status: "failed",
            leaseUntil: FieldValue.delete(),
            lastErrorCode: String((error as { code?: unknown })?.code || "deletion_failed").slice(
              0,
              80,
            ),
            lastFailedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          { merge: true },
        );
      }
    }
  },
);

export const expireUnusedRewards = onSchedule(
  { region: "asia-southeast1", schedule: "every 60 minutes", timeZone: "Asia/Bangkok" },
  async () => {
    const now = Timestamp.now();
    const expiredSnap = await db
      .collection("reward_history")
      .where("expiresAt", "<=", now)
      .limit(400)
      .get();
    let updated = 0;

    for (let index = 0; index < expiredSnap.docs.length; index += 20) {
      const group = expiredSnap.docs.slice(index, index + 20);
      const results = await Promise.all(
        group.map((expiredDoc) =>
          db.runTransaction(async (tx) => {
            const current = await tx.get(expiredDoc.ref);
            if (
              !current.exists ||
              current.data()?.status !== "unused" ||
              (timestampMillis(current.data()?.expiresAt) ?? Number.POSITIVE_INFINITY) >
                now.toMillis()
            ) {
              return false;
            }
            tx.set(
              expiredDoc.ref,
              { status: "expired", expiredAt: now, updatedAt: now },
              { merge: true },
            );
            return true;
          }),
        ),
      );
      updated += results.filter(Boolean).length;
    }

    console.info("Đã hết hạn mã quà", { updated });
  },
);

export const notifyStaffOnCustomerCheckin = onDocumentCreated(
  { region: "asia-southeast1", document: "chair_sessions/{sessionId}" },
  async (event) => {
    const session = event.data?.data();
    const salonId = String(session?.salonId || "");
    const branchId = String(session?.branchId || "");
    if (!salonId || !branchId || session?.status !== "waiting") {
      return;
    }
    try {
      await sendManagerPush({
        salonId,
        branchId,
        role: "staff",
        title: "Có khách mới đang chờ",
        body: "Mở HAIRCUT Manager để xem hàng chờ tại chi nhánh.",
        data: {
          route: "/queue",
          sessionId: event.params.sessionId,
          branchId,
        },
      });
    } catch (error) {
      console.error("Không gửi được thông báo khách mới", {
        salonId,
        branchId,
        sessionId: event.params.sessionId,
        errorCode: String((error as { code?: unknown })?.code || "push_failed"),
      });
      throw error;
    }
  },
);

export const notifyOwnerOnPointRequest = onDocumentCreated(
  { region: "asia-southeast1", document: "point_requests/{requestId}" },
  async (event) => {
    const pointRequest = event.data?.data();
    const salonId = String(pointRequest?.salonId || "");
    if (!salonId || pointRequest?.status !== "pending") {
      return;
    }
    try {
      await sendManagerPush({
        salonId,
        role: "owner",
        title: "Có yêu cầu cộng điểm mới",
        body: "Mở HAIRCUT Manager để kiểm tra và duyệt yêu cầu.",
        data: {
          route: "/approvals",
          requestId: event.params.requestId,
        },
      });
    } catch (error) {
      console.error("Không gửi được thông báo yêu cầu điểm", {
        salonId,
        requestId: event.params.requestId,
        errorCode: String((error as { code?: unknown })?.code || "push_failed"),
      });
      throw error;
    }
  },
);

export const notifyStaffOnPointRequestResult = onDocumentUpdated(
  { region: "asia-southeast1", document: "point_requests/{requestId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (
      before?.status === after?.status ||
      (after?.status !== "approved" && after?.status !== "rejected")
    ) {
      return;
    }
    const salonId = String(after?.salonId || "");
    const staffId = String(after?.staffId || "");
    if (!salonId || !staffId) {
      return;
    }
    try {
      await sendManagerPush({
        salonId,
        uid: staffId,
        title:
          after.status === "approved" ? "Yêu cầu điểm đã được duyệt" : "Yêu cầu điểm bị từ chối",
        body: "Mở HAIRCUT Manager để xem trạng thái lượt phục vụ.",
        data: {
          route: "/activity",
          requestId: event.params.requestId,
          status: String(after.status),
        },
      });
    } catch (error) {
      console.error("Không gửi được kết quả yêu cầu điểm", {
        salonId,
        requestId: event.params.requestId,
        errorCode: String((error as { code?: unknown })?.code || "push_failed"),
      });
      throw error;
    }
  },
);
