import type { Bucket } from "@google-cloud/storage";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createAuthorization } from "../../authz/authorization";
import { isPrivateHaircutObject, revokeHaircutDownloadTokens } from "./photoDownloadTokens";

export const PRIVATE_PHOTO_URL_TTL_MS = 15 * 60_000;
type PhotoRequest = { auth?: { uid: string } | null; data?: unknown };
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export async function privatePhotoUrl(
  bucket: Bucket,
  path: string,
  expiresAtMs: number,
): Promise<string> {
  if (!isPrivateHaircutObject(path))
    throw new HttpsError("invalid-argument", "Đường dẫn ảnh không hợp lệ");
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (
    metadata.contentType !== "image/jpeg" ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > 3 * 1024 * 1024
  ) {
    throw new HttpsError("failed-precondition", "Ảnh không còn hợp lệ");
  }
  await revokeHaircutDownloadTokens(file);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAtMs,
    responseType: "image/jpeg",
    responseDisposition: "inline",
  });
  return url;
}

export function createPrivatePhotoReader(
  db: Firestore,
  bucket: Bucket,
  rateLimit: (uid: string, salonId: string) => Promise<void>,
  signer = (path: string, expiresAtMs: number) => privatePhotoUrl(bucket, path, expiresAtMs),
  clock = Date.now,
) {
  const { assertSalonRole, assertBranchAccess } = createAuthorization(db);
  return async (request: PhotoRequest) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Bạn cần đăng nhập để xem ảnh");
    const data = request.data as Record<string, unknown> | null;
    if (
      !data ||
      Array.isArray(data) ||
      !validId(data.salonId) ||
      !validId(data.customerId) ||
      !validId(data.sessionId) ||
      !Array.isArray(data.photoPaths) ||
      data.photoPaths.length < 1 ||
      data.photoPaths.length > 3
    ) {
      throw new HttpsError("invalid-argument", "Thông tin ảnh không hợp lệ");
    }
    const { salonId, customerId, sessionId } = data;
    const paths = data.photoPaths as unknown[];
    if (
      paths.some(
        (path) =>
          typeof path !== "string" ||
          !isPrivateHaircutObject(path) ||
          !["haircuts", "sessions"].some((kind) =>
            path.startsWith(`salons/${salonId}/customers/${customerId}/${kind}/${sessionId}/`),
          ),
      )
    ) {
      throw new HttpsError("invalid-argument", "Đường dẫn ảnh không thuộc lượt cắt này");
    }
    const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
    await rateLimit(uid, salonId);
    const [customerSnap, sessionSnap] = await Promise.all([
      db.doc(`customers/${customerId}`).get(),
      db.doc(`chair_sessions/${sessionId}`).get(),
    ]);
    const customer = customerSnap.data();
    const session = sessionSnap.data();
    if (
      !customerSnap.exists ||
      customer?.salonId !== salonId ||
      customer.allowPhoto !== true ||
      !sessionSnap.exists ||
      session?.salonId !== salonId ||
      session.customerId !== customerId ||
      !validId(session.branchId) ||
      (session.approvalMode === "staff_confirmation" && session.photoConsentGranted !== true)
    ) {
      throw new HttpsError("permission-denied", "Bạn không được xem ảnh của lượt cắt này");
    }
    await assertBranchAccess(user, session.branchId);
    const expiresAtMs = clock() + PRIVATE_PHOTO_URL_TTL_MS;
    const photos: Array<{ path: string; url: string }> = [];
    for (const path of [...new Set(paths as string[])]) {
      if (path.includes("/sessions/")) {
        const operationId = path.slice(path.lastIndexOf("/") + 1, -4);
        const operation = (await db.doc(`photo_upload_operations/${operationId}`).get()).data();
        if (
          operation?.status !== "finalized" ||
          operation.salonId !== salonId ||
          operation.customerId !== customerId ||
          operation.sessionId !== sessionId ||
          operation.storagePath !== path
        ) {
          throw new HttpsError("failed-precondition", "Ảnh chưa được xác nhận hoàn tất");
        }
      }
      const file = bucket.file(path);
      const [metadata] = await file.getMetadata();
      const canRead =
        user.role === "owner" ||
        session.assignedStaffId === uid ||
        (session.approvalMode === "staff_confirmation" &&
          session.photoConsentGranted === true &&
          metadata.metadata?.uploaderUid === uid);
      if (!canRead)
        throw new HttpsError("permission-denied", "Bạn không phụ trách ảnh của lượt cắt này");
      try {
        await revokeHaircutDownloadTokens(file);
        photos.push({ path, url: await signer(path, expiresAtMs) });
      } catch {
        throw new HttpsError("unavailable", "Chưa thể tạo liên kết xem ảnh. Vui lòng thử lại.");
      }
    }
    return { photos, expiresAtMs };
  };
}
