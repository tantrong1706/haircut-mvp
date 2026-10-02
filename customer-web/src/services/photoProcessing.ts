export const PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const PHOTO_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 2048;
export const PHOTO_MAX_PIXELS = 24_000_000;

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export function classifyImageBytes(bytes: Uint8Array): SupportedImageMime | "image/heic" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
    ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(
      String.fromCharCode(...bytes.slice(8, 12)),
    )
  ) {
    return "image/heic";
  }
  return null;
}

export async function validateHaircutPhotoSource(file: File): Promise<SupportedImageMime> {
  if (!file || file.size <= 0) {
    throw new Error("Vui lòng chọn ảnh kiểu tóc");
  }
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new Error("Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 12MB.");
  }

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = classifyImageBytes(bytes);
  if (detected === "image/heic") {
    throw new Error(
      "Ảnh HEIC chưa được thiết bị này hỗ trợ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
    );
  }
  if (!detected) {
    throw new Error("File đã chọn không phải ảnh JPEG, PNG hoặc WebP hợp lệ.");
  }
  return detected;
}

export type ProcessedHaircutPhoto = {
  blob: Blob;
  width: number;
  height: number;
  checksum: string;
  contentType: "image/jpeg";
};

export async function processHaircutPhoto(file: File): Promise<ProcessedHaircutPhoto> {
  await validateHaircutPhotoSource(file);
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      return await processHaircutPhotoInWorker(file);
    } catch {
      // Older WebViews may expose Worker/OffscreenCanvas incompletely. The guarded fallback remains safe.
    }
  }
  return processHaircutPhotoOnMainThread(file);
}

async function processHaircutPhotoOnMainThread(file: File): Promise<ProcessedHaircutPhoto> {
  const bitmap = await decodeImage(file);
  try {
    if (bitmap.width * bitmap.height > PHOTO_MAX_PIXELS) {
      throw new Error("Ảnh có độ phân giải quá lớn. Vui lòng chọn ảnh dưới 24 megapixel.");
    }
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Thiết bị không xử lý được ảnh này");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 0.9);
    for (const quality of [0.8, 0.7, 0.6]) {
      if (blob.size <= PHOTO_MAX_UPLOAD_BYTES) break;
      blob = await canvasToBlob(canvas, quality);
    }
    canvas.width = 1;
    canvas.height = 1;
    if (blob.size > PHOTO_MAX_UPLOAD_BYTES) {
      throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.");
    }
    return {
      blob,
      width,
      height,
      checksum: await sha256Hex(blob),
      contentType: "image/jpeg",
    };
  } finally {
    bitmap.close();
  }
}

function processHaircutPhotoInWorker(file: File): Promise<ProcessedHaircutPhoto> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./photoProcessing.worker.ts", import.meta.url), {
      type: "module",
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      callback();
    };
    const timer = globalThis.setTimeout(
      () => finish(() => reject(new Error("Xử lý ảnh quá thời gian chờ"))),
      30_000,
    );
    worker.onmessage = (event: MessageEvent<ProcessedHaircutPhoto | { error: string }>) => {
      const message = event.data as ProcessedHaircutPhoto & { error?: string };
      if (typeof message.error === "string") {
        finish(() => reject(new Error(message.error)));
        return;
      }
      finish(() => resolve(message));
    };
    worker.onerror = () => finish(() => reject(new Error("Không khởi động được bộ xử lý ảnh")));
    worker.postMessage({
      file,
      maxDimension: PHOTO_MAX_DIMENSION,
      maxPixels: PHOTO_MAX_PIXELS,
      maxBytes: PHOTO_MAX_UPLOAD_BYTES,
    });
  });
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Không đọc được ảnh đã chọn"));
        element.src = objectUrl;
      });
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh kiểu tóc"))),
      "image/jpeg",
      quality,
    );
  });
}

async function sha256Hex(blob: Blob): Promise<string> {
  if (!crypto.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}
