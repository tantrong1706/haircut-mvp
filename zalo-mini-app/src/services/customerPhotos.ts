import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, getFirebaseStorage } from "./firebase";

const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 3 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const ALLOWED_SOURCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_HAIRCUT_PHOTOS = 3;

export type UploadedHaircutPhoto = {
  id: string;
  path: string;
  url: string;
};

export async function uploadHaircutPhoto(input: {
  salonId: string;
  customerId: string;
  sessionId: string;
  file: File;
}): Promise<UploadedHaircutPhoto> {
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  const currentUser = auth?.currentUser;

  if (!currentUser || !storage) {
    throw new Error("Bạn cần đăng nhập nhân viên để tải ảnh kiểu tóc");
  }

  const salonId = safeDocumentId(input.salonId, "salon");
  const customerId = safeDocumentId(input.customerId, "khách hàng");
  const sessionId = safeDocumentId(input.sessionId, "lượt cắt");
  const sourceFile = validateSourceFile(input.file);
  const imageBlob = await resizeHaircutPhoto(sourceFile);

  if (imageBlob.size > MAX_UPLOAD_SIZE) {
    throw new Error("Ảnh vẫn còn quá lớn sau khi nén. Vui lòng chọn ảnh khác.");
  }

  const id = randomPhotoId();
  const path = `salons/${salonId}/customers/${customerId}/haircuts/${sessionId}/${id}.jpg`;
  const photoRef = ref(storage, path);

  await uploadBytes(photoRef, imageBlob, {
    contentType: "image/jpeg",
    customMetadata: {
      salonId,
      customerId,
      sessionId,
      uploaderUid: currentUser.uid,
    },
  });

  return {
    id,
    path,
    url: await getDownloadURL(photoRef),
  };
}

export async function deleteHaircutPhoto(path: string) {
  const storage = getFirebaseStorage();
  if (!storage || !path.startsWith("salons/")) {
    throw new Error("Không tìm thấy ảnh cần xóa");
  }

  await deleteObject(ref(storage, path));
}

function validateSourceFile(file: File) {
  if (!file) {
    throw new Error("Vui lòng chọn ảnh kiểu tóc");
  }
  if (!ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new Error("Ảnh chỉ hỗ trợ định dạng JPG, PNG hoặc WebP");
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("Ảnh gốc quá lớn. Vui lòng chọn ảnh dưới 12MB.");
  }

  return file;
}

function safeDocumentId(value: string, label: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error(`Mã ${label} không hợp lệ`);
  }
  return normalized;
}

async function resizeHaircutPhoto(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Thiết bị không xử lý được ảnh này");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 0.84);
  if (blob.size > MAX_UPLOAD_SIZE) {
    blob = await canvasToBlob(canvas, 0.68);
  }
  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không đọc được ảnh. Vui lòng chọn ảnh JPG, PNG hoặc WebP khác."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Không nén được ảnh kiểu tóc"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

function randomPhotoId() {
  if (typeof crypto.randomUUID === "function") {
    return `photo-${crypto.randomUUID()}`;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `photo-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}
