import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from "firebase/storage";
import { callFunction, getFirebaseAuth, getFirebaseStorage } from "./firebase";
import { PHOTO_MAX_UPLOAD_BYTES, processHaircutPhoto } from "./photoProcessing";

export const MAX_HAIRCUT_PHOTOS = 3;
const DEFAULT_UPLOAD_TIMEOUT_MS = 45_000;
const MAX_UPLOAD_ATTEMPTS = 3;

export type UploadedHaircutPhoto = {
  id: string;
  operationId?: string;
  requestId?: string;
  path: string;
  url: string;
};

export async function recoverHaircutPhotoUploads(input: {
  salonId: string;
  sessionId: string;
}): Promise<UploadedHaircutPhoto[]> {
  const storage = getFirebaseStorage();
  if (!storage) return [];
  const result = await callFunction<
    { salonId: string; sessionId: string },
    {
      photos: Array<
        Omit<UploadedHaircutPhoto, "url"> & {
          status: "pending" | "uploading" | "uploaded" | "finalized";
        }
      >;
    }
  >("getRecoverableHaircutPhotoUploads", {
    salonId: safeDocumentId(input.salonId, "salon"),
    sessionId: safeDocumentId(input.sessionId, "lượt cắt"),
  });
  if (!Array.isArray(result.photos)) return [];
  const recovered = await Promise.allSettled(
    result.photos.slice(0, MAX_HAIRCUT_PHOTOS).map(async ({ status, ...photo }) => {
      if (status !== "finalized") {
        await callFunction<{ salonId: string; operationId: string }, FinalizePhotoUploadResult>(
          "finalizeHaircutPhotoUpload",
          { salonId: input.salonId, operationId: photo.operationId ?? photo.id },
        );
      }
      return {
        ...photo,
        url: await getDownloadURL(ref(storage, photo.path)),
      };
    }),
  );
  return recovered.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
}

type BeginPhotoUploadResult = {
  operationId: string;
  requestId: string;
  storagePath: string;
  status: "pending" | "uploading" | "uploaded" | "finalized";
  expectedMaxBytes: number;
  expiresAtMs: number;
};

type FinalizePhotoUploadResult = {
  operationId: string;
  requestId: string;
  storagePath: string;
  status: "finalized";
  alreadyFinalized: boolean;
};

export async function uploadHaircutPhoto(input: {
  salonId: string;
  branchId: string;
  customerId: string;
  sessionId: string;
  file: File;
  requestId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
}): Promise<UploadedHaircutPhoto> {
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  const currentUser = auth?.currentUser;
  if (!currentUser || !storage) {
    throw new Error("Bạn cần đăng nhập tài khoản salon để tải ảnh kiểu tóc");
  }
  const salonId = safeDocumentId(input.salonId, "salon");
  const branchId = safeDocumentId(input.branchId, "chi nhánh");
  const customerId = safeDocumentId(input.customerId, "khách hàng");
  const sessionId = safeDocumentId(input.sessionId, "lượt cắt");
  const requestId = input.requestId ?? randomRequestId();
  const processed = await processHaircutPhoto(input.file);
  if (processed.blob.size > PHOTO_MAX_UPLOAD_BYTES) {
    throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.");
  }

  const begin = await retryOperation(
    () =>
      callFunction<
        {
          salonId: string;
          sessionId: string;
          requestId: string;
          expectedContentType: string;
          expectedBytes: number;
          checksum: string;
        },
        BeginPhotoUploadResult
      >("beginHaircutPhotoUpload", {
        salonId,
        sessionId,
        requestId,
        expectedContentType: processed.contentType,
        expectedBytes: processed.blob.size,
        checksum: processed.checksum,
      }),
    { signal: input.signal, timeoutMs: input.timeoutMs },
  );

  const photoRef = ref(storage, begin.storagePath);
  if (begin.status !== "finalized") {
    await uploadWithRetry({
      createTask: () =>
        uploadBytesResumable(photoRef, processed.blob, {
          contentType: "image/jpeg",
          customMetadata: {
            salonId,
            branchId,
            customerId,
            sessionId,
            uploaderUid: currentUser.uid,
            operationId: begin.operationId,
            requestId,
            checksum: processed.checksum,
          },
        }),
      signal: input.signal,
      timeoutMs: input.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
      onProgress: input.onProgress,
    });
    await retryOperation(
      () =>
        callFunction<{ salonId: string; operationId: string }, FinalizePhotoUploadResult>(
          "finalizeHaircutPhotoUpload",
          { salonId, operationId: begin.operationId },
        ),
      { signal: input.signal, timeoutMs: input.timeoutMs },
    );
  }
  input.onProgress?.(100);
  return {
    id: begin.operationId,
    operationId: begin.operationId,
    requestId,
    path: begin.storagePath,
    url: await getDownloadURL(photoRef),
  };
}

export async function deleteHaircutPhoto(path: string, salonId?: string) {
  const operationId = operationIdFromPath(path);
  if (operationId && salonId) {
    await callFunction<
      { salonId: string; operationId: string },
      { status: "cancelled"; alreadyCancelled: boolean }
    >("cancelHaircutPhotoUpload", { salonId, operationId });
    return;
  }

  const storage = getFirebaseStorage();
  if (!storage) throw new Error("Không tìm thấy ảnh cần xóa");
  let photoRef;
  try {
    photoRef = ref(storage, path);
  } catch {
    throw new Error("Không tìm thấy ảnh cần xóa");
  }
  if (
    !/^salons\/[^/]+\/customers\/[^/]+\/haircuts\/[^/]+\/photo-[A-Za-z0-9-]{12,80}\.jpg$/.test(
      photoRef.fullPath,
    )
  ) {
    throw new Error("Đường dẫn ảnh kiểu tóc không hợp lệ");
  }
  await deleteObject(photoRef);
}

async function uploadWithRetry(input: {
  createTask: () => UploadTask;
  signal?: AbortSignal;
  timeoutMs: number;
  onProgress?: (progress: number) => void;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    if (input.signal?.aborted) throw abortError();
    try {
      await waitForUploadTask(input.createTask(), input);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attempt === MAX_UPLOAD_ATTEMPTS - 1) throw error;
      await backoff(attempt, input.signal);
    }
  }
  throw lastError;
}

function waitForUploadTask(
  task: UploadTask,
  input: { signal?: AbortSignal; timeoutMs: number; onProgress?: (progress: number) => void },
) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      unsubscribe();
      callback();
    };
    const abort = () => {
      task.cancel();
      finish(() => reject(abortError()));
    };
    const timer = globalThis.setTimeout(() => {
      task.cancel();
      finish(() => reject(new Error("Tải ảnh quá thời gian chờ. Hệ thống sẽ thử lại an toàn.")));
    }, input.timeoutMs);
    input.signal?.addEventListener("abort", abort, { once: true });
    unsubscribe = task.on(
      "state_changed",
      (snapshot) => {
        const progress = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        input.onProgress?.(Math.min(99, progress));
      },
      (error) => finish(() => reject(error)),
      () => finish(resolve),
    );
  });
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  input: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    if (input.signal?.aborted) throw abortError();
    try {
      return await promiseWithTimeout(operation(), input.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
      if (
        input.signal?.aborted ||
        !isRetryableOperationError(error) ||
        attempt === MAX_UPLOAD_ATTEMPTS - 1
      ) {
        throw error;
      }
      await backoff(attempt, input.signal);
    }
  }
  throw lastError;
}

function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new Error("Máy chủ phản hồi quá chậm. Vui lòng thử lại an toàn.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isRetryableUploadError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  return ![
    "storage/unauthorized",
    "storage/invalid-argument",
    "storage/object-not-found",
    "storage/canceled",
  ].includes(code);
}

function isRetryableOperationError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  return ![
    "functions/invalid-argument",
    "functions/unauthenticated",
    "functions/permission-denied",
    "functions/not-found",
    "functions/already-exists",
    "functions/failed-precondition",
  ].includes(code);
}

async function backoff(attempt: number, signal?: AbortSignal) {
  const bytes = crypto.getRandomValues(new Uint8Array(1));
  const delay = Math.min(4_000, 300 * 2 ** attempt + bytes[0]);
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function safeDocumentId(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) throw new Error(`Mã ${label} không hợp lệ`);
  return normalized;
}

function randomRequestId() {
  if (typeof crypto.randomUUID === "function") return `photo-request-${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `photo-request-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function operationIdFromPath(path: string) {
  return path.match(/\/(op-[a-f0-9]{40})\.jpg$/)?.[1] ?? null;
}

function abortError() {
  return new DOMException("Đã hủy tải ảnh", "AbortError");
}
