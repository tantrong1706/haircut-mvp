type WorkerInput = {
  file: File;
  maxDimension: number;
  maxPixels: number;
  maxBytes: number;
};

type WorkerOutput = {
  blob: Blob;
  width: number;
  height: number;
  checksum: string;
  contentType: "image/jpeg";
};

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerInput>) => void) | null;
  postMessage: (message: WorkerOutput | { error: string }) => void;
};

workerScope.onmessage = async ({ data }) => {
  try {
    const bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" });
    try {
      if (bitmap.width * bitmap.height > data.maxPixels) {
        throw new Error("Ảnh có độ phân giải quá lớn. Vui lòng chọn ảnh dưới 24 megapixel.");
      }
      const scale = Math.min(1, data.maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Thiết bị không xử lý được ảnh này");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);

      let blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
      for (const quality of [0.8, 0.7, 0.6]) {
        if (blob.size <= data.maxBytes) break;
        blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      }
      if (blob.size > data.maxBytes) {
        throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.");
      }
      workerScope.postMessage({
        blob,
        width,
        height,
        checksum: await sha256Hex(blob),
        contentType: "image/jpeg",
      });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : "Không xử lý được ảnh đã chọn",
    });
  }
};

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export {};
