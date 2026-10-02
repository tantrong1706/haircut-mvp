import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callFunction: vi.fn(),
  getDownloadURL: vi.fn(),
  processHaircutPhoto: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));

vi.mock("./firebase", () => ({
  callFunction: mocks.callFunction,
  getFirebaseAuth: () => ({ currentUser: { uid: "staff-a" } }),
  getFirebaseStorage: () => ({ app: {} }),
}));

vi.mock("./photoProcessing", () => ({
  PHOTO_MAX_UPLOAD_BYTES: 3 * 1024 * 1024,
  processHaircutPhoto: mocks.processHaircutPhoto,
}));

vi.mock("firebase/storage", () => ({
  deleteObject: vi.fn(),
  getDownloadURL: mocks.getDownloadURL,
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadBytesResumable: mocks.uploadBytesResumable,
}));

import { recoverHaircutPhotoUploads, uploadHaircutPhoto } from "./customerPhotos";

const operationId = `op-${"a".repeat(40)}`;
const storagePath = `salons/salon-a/customers/customer-a/sessions/session-a/${operationId}.jpg`;
const processed = {
  blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
  width: 800,
  height: 600,
  checksum: "a".repeat(64),
  contentType: "image/jpeg" as const,
};

function beginResult(status: "pending" | "finalized" = "pending") {
  return {
    operationId,
    requestId: "photo-request-a",
    storagePath,
    status,
    expectedMaxBytes: 3 * 1024 * 1024,
    expiresAtMs: Date.now() + 60_000,
  };
}

function successfulTask() {
  return {
    cancel: vi.fn(),
    on: vi.fn(
      (
        _event: string,
        progress: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
        _error: (error: unknown) => void,
        complete: () => void,
      ) => {
        progress({ bytesTransferred: 2, totalBytes: 4 });
        complete();
        return vi.fn();
      },
    ),
  };
}

describe("customer photo upload lifecycle", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.processHaircutPhoto.mockResolvedValue(processed);
    mocks.getDownloadURL.mockResolvedValue("https://storage.test/photo-a");
    mocks.callFunction.mockImplementation((name: string) => {
      if (name === "beginHaircutPhotoUpload") return Promise.resolve(beginResult());
      if (name === "finalizeHaircutPhotoUpload") {
        return Promise.resolve({ ...beginResult("finalized"), alreadyFinalized: false });
      }
      throw new Error(`Unexpected function ${name}`);
    });
  });

  it("upload resumable báo tiến độ rồi finalize operation", async () => {
    mocks.uploadBytesResumable.mockReturnValue(successfulTask());
    const progress: number[] = [];

    const photo = await uploadHaircutPhoto({
      salonId: "salon-a",
      branchId: "branch-a",
      customerId: "customer-a",
      sessionId: "session-a",
      requestId: "photo-request-a",
      file: new File([processed.blob], "haircut.jpg", { type: "image/jpeg" }),
      onProgress: (value) => progress.push(value),
    });

    expect(photo).toMatchObject({ id: operationId, path: storagePath });
    expect(progress).toEqual([50, 100]);
    expect(mocks.callFunction.mock.calls.map(([name]) => name)).toEqual([
      "beginHaircutPhotoUpload",
      "finalizeHaircutPhotoUpload",
    ]);
    expect(mocks.uploadBytesResumable).toHaveBeenCalledOnce();
  });

  it("retry tạo upload task mới sau lỗi mạng có thể thử lại", async () => {
    vi.useFakeTimers();
    const retryableError = { code: "storage/retry-limit-exceeded" };
    const failedTask = {
      cancel: vi.fn(),
      on: vi.fn(
        (
          _event: string,
          _progress: (snapshot: unknown) => void,
          error: (caught: unknown) => void,
        ) => {
          error(retryableError);
          return vi.fn();
        },
      ),
    };
    mocks.uploadBytesResumable
      .mockReturnValueOnce(failedTask)
      .mockReturnValueOnce(successfulTask());

    const promise = uploadHaircutPhoto({
      salonId: "salon-a",
      branchId: "branch-a",
      customerId: "customer-a",
      sessionId: "session-a",
      requestId: "photo-request-a",
      file: new File([processed.blob], "haircut.jpg", { type: "image/jpeg" }),
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({ id: operationId });
    expect(mocks.uploadBytesResumable).toHaveBeenCalledTimes(2);
  });

  it("hủy upload đang chạy và không finalize", async () => {
    const cancel = vi.fn();
    let registered!: () => void;
    const registeredPromise = new Promise<void>((resolve) => {
      registered = resolve;
    });
    mocks.uploadBytesResumable.mockReturnValue({
      cancel,
      on: vi.fn(() => {
        registered();
        return vi.fn();
      }),
    });
    const controller = new AbortController();
    const promise = uploadHaircutPhoto({
      salonId: "salon-a",
      branchId: "branch-a",
      customerId: "customer-a",
      sessionId: "session-a",
      requestId: "photo-request-a",
      file: new File([processed.blob], "haircut.jpg", { type: "image/jpeg" }),
      signal: controller.signal,
    });
    await registeredPromise;
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.callFunction.mock.calls.map(([name]) => name)).toEqual([
      "beginHaircutPhotoUpload",
    ]);
  });

  it("khôi phục operation theo session rồi lấy URL bằng Storage Rules", async () => {
    mocks.callFunction.mockResolvedValue({
      photos: [
        {
          id: operationId,
          operationId,
          requestId: "photo-request-a",
          path: storagePath,
          status: "finalized",
        },
      ],
    });

    await expect(
      recoverHaircutPhotoUploads({ salonId: "salon-a", sessionId: "session-a" }),
    ).resolves.toEqual([
      {
        id: operationId,
        operationId,
        requestId: "photo-request-a",
        path: storagePath,
        url: "https://storage.test/photo-a",
      },
    ]);
  });

  it("finalizes the same pending operation after reload instead of creating another", async () => {
    mocks.callFunction.mockImplementation((name: string) => {
      if (name === "getRecoverableHaircutPhotoUploads") {
        return Promise.resolve({
          photos: [
            {
              id: operationId,
              operationId,
              requestId: "photo-request-a",
              path: storagePath,
              status: "pending",
            },
          ],
        });
      }
      if (name === "finalizeHaircutPhotoUpload") {
        return Promise.resolve({ ...beginResult("finalized"), alreadyFinalized: false });
      }
      throw new Error(`Unexpected function ${name}`);
    });

    await expect(
      recoverHaircutPhotoUploads({ salonId: "salon-a", sessionId: "session-a" }),
    ).resolves.toHaveLength(1);
    expect(mocks.callFunction.mock.calls.map(([name]) => name)).toEqual([
      "getRecoverableHaircutPhotoUploads",
      "finalizeHaircutPhotoUpload",
    ]);
  });
});
