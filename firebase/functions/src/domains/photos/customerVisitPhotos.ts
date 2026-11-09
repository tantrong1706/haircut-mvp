import type { Bucket } from "@google-cloud/storage";
import { Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  MAX_HAIRCUT_PHOTOS,
  isExpectedHaircutPhotoPath,
  storageObjectNameFromDownloadUrl,
} from "../../customerPhotos";
import { isPrivateHaircutObject } from "./photoDownloadTokens";
import { PRIVATE_PHOTO_URL_TTL_MS, privatePhotoUrl } from "./privatePhotoAccess";

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.slice(0, MAX_HAIRCUT_PHOTOS).filter((item) => typeof item === "string")
    : [];

type Scope = { uid: string; salonId: string; customerId: string };

export function customerMayViewVisitPhotos(customer: DocumentData | undefined, scope: Scope) {
  return (
    customer?.salonId === scope.salonId &&
    customer.firebaseUid === scope.uid &&
    customer.allowPhoto === true
  );
}

export function hasCustomerVisitPhotos(record: DocumentData, bucketName: string) {
  return (
    validId(record.pointRequestId) &&
    (strings(record.photoPaths).some(isPrivateHaircutObject) ||
      strings(record.photoUrls).some((url) => {
        const path = storageObjectNameFromDownloadUrl(url, bucketName);
        return path !== null && isPrivateHaircutObject(path);
      }))
  );
}

export async function readCustomerVisitPhotos(
  db: Firestore,
  bucket: Bucket,
  scope: Scope,
  recordId: unknown,
) {
  if (!validId(recordId)) throw new HttpsError("invalid-argument", "Lượt cắt không hợp lệ.");
  const { customerId, salonId } = scope;
  const paths = await db.runTransaction(
    async (tx) => {
      const [customerSnap, recordSnap] = await Promise.all([
        tx.get(db.doc(`customers/${customerId}`)),
        tx.get(db.doc(`haircut_records/${recordId}`)),
      ]);
      const customer = customerSnap.data();
      const record = recordSnap.data();
      if (!record || record.salonId !== salonId || record.customerId !== customerId)
        throw new HttpsError("not-found", "Không tìm thấy lượt cắt này.");
      if (
        !customerMayViewVisitPhotos(customer, scope) ||
        !validId(record.branchId) ||
        !hasCustomerVisitPhotos(record, bucket.name)
      )
        return [];

      const point = (await tx.get(db.doc(`point_requests/${record.pointRequestId}`))).data();
      if (
        point?.status !== "approved" ||
        point.salonId !== salonId ||
        point.customerId !== customerId ||
        point.branchId !== record.branchId ||
        !validId(point.sessionId)
      )
        return [];
      const sessionId = point.sessionId;
      const session = (await tx.get(db.doc(`chair_sessions/${sessionId}`))).data();
      if (
        session?.status !== "completed" ||
        session.salonId !== salonId ||
        session.customerId !== customerId ||
        session.branchId !== record.branchId ||
        session.photoConsentGranted !== true ||
        session.photoConsentRevokedAt != null
      )
        return [];

      // Consent for a future visit does not re-enable photos from a withdrawn visit.
      const revokedAt = customer?.photoConsentRevokedAt;
      const grantedAt = session.photoConsentConfirmedAt ?? session.photoConsentAt;
      if (
        revokedAt != null &&
        (!(revokedAt instanceof Timestamp) ||
          !(grantedAt instanceof Timestamp) ||
          grantedAt.toMillis() <= revokedAt.toMillis())
      )
        return [];

      const prefix = `salons/${salonId}/customers/${customerId}/sessions/${sessionId}/`;
      const uploaded = strings(record.photoPaths).filter(
        (path) => isPrivateHaircutObject(path) && path.startsWith(prefix),
      );
      const legacy = strings(record.photoUrls).flatMap((url) => {
        const path = storageObjectNameFromDownloadUrl(url, bucket.name);
        return path && isExpectedHaircutPhotoPath(path, { salonId, customerId, sessionId })
          ? [path]
          : [];
      });
      return [...new Set([...uploaded, ...legacy])].slice(0, MAX_HAIRCUT_PHOTOS);
    },
    { readOnly: true },
  );

  const expiresAt = Date.now() + PRIVATE_PHOTO_URL_TTL_MS;
  const results = await Promise.allSettled(
    paths.map((path) => privatePhotoUrl(bucket, path, expiresAt)),
  );
  const urls = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (paths.length && !urls.length)
    throw new HttpsError("unavailable", "Chưa tải được ảnh. Vui lòng thử lại.");
  return urls;
}
