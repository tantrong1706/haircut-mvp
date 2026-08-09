import { createHash } from "node:crypto";

export const PHOTO_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_UPLOAD_OPERATION_TTL_MS = 30 * 60 * 1000;
export const PHOTO_UPLOAD_ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

export type PhotoUploadStatus =
  "pending" | "uploading" | "uploaded" | "finalized" | "cancelled" | "expired" | "failed";

type PhotoPathContext = {
  salonId: string;
  customerId: string;
  sessionId: string;
  operationId: string;
};

type PhotoObjectContext = PhotoPathContext & {
  branchId: string;
  staffUid: string;
  requestId: string;
};

type StorageObjectMetadata = {
  contentType?: string | null;
  size?: string | number | null;
  metadata?: Record<string, unknown> | null;
};

function safeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error(`${label} không hợp lệ`);
  }
  return normalized;
}

export function buildPhotoUploadOperationId(
  salonId: string,
  sessionId: string,
  staffUid: string,
  requestId: string,
): string {
  const source = [salonId, sessionId, staffUid, requestId]
    .map((value, index) => safeSegment(value, `photo operation segment ${index + 1}`))
    .join("\u0000");
  return `op-${createHash("sha256").update(source).digest("hex").slice(0, 40)}`;
}

export function buildPhotoUploadStoragePath(input: PhotoPathContext): string {
  const salonId = safeSegment(input.salonId, "salonId");
  const customerId = safeSegment(input.customerId, "customerId");
  const sessionId = safeSegment(input.sessionId, "sessionId");
  const operationId = safeSegment(input.operationId, "operationId");
  return `salons/${salonId}/customers/${customerId}/sessions/${sessionId}/${operationId}.jpg`;
}

export function isExpectedPhotoUploadPath(path: string, input: PhotoPathContext): boolean {
  try {
    return path === buildPhotoUploadStoragePath(input);
  } catch {
    return false;
  }
}

export function validatePhotoUploadObject(
  object: StorageObjectMetadata,
  input: PhotoObjectContext,
): boolean {
  const metadata = object.metadata ?? {};
  const size = Number(object.size ?? 0);
  return (
    object.contentType === "image/jpeg" &&
    Number.isFinite(size) &&
    size > 0 &&
    size <= PHOTO_UPLOAD_MAX_BYTES &&
    String(metadata.salonId || "") === input.salonId &&
    String(metadata.branchId || "") === input.branchId &&
    String(metadata.customerId || "") === input.customerId &&
    String(metadata.sessionId || "") === input.sessionId &&
    String(metadata.uploaderUid || "") === input.staffUid &&
    String(metadata.operationId || "") === input.operationId &&
    String(metadata.requestId || "") === input.requestId
  );
}

export function validatePhotoUploadBytes(bytes: Buffer, expectedChecksum: string): boolean {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return false;
  }
  return createHash("sha256").update(bytes).digest("hex") === expectedChecksum;
}

export function isPhotoUploadOperationExpired(expiresAtMs: number, nowMs = Date.now()): boolean {
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;
}
