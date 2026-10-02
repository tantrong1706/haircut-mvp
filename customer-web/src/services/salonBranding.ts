import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { callFunction, getFirebaseAuth, getFirebaseStorage } from "./firebase";
import { prepareSquareImage } from "./imageProcessing";

export const SALON_AVATAR_OBJECT_NAME = "avatar.webp";

export function salonAvatarObjectPath(salonId: string) {
  return `salons/${salonId}/branding/${SALON_AVATAR_OBJECT_NAME}`;
}

export function isSalonAvatarDownloadUrl(downloadUrl: string, bucketName: string, salonId: string) {
  if (!bucketName || !salonId) {
    return false;
  }

  try {
    const parsed = new URL(downloadUrl);
    const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "firebasestorage.googleapis.com" ||
      !match ||
      decodeURIComponent(match[1]) !== bucketName
    ) {
      return false;
    }

    return decodeURIComponent(match[2]) === salonAvatarObjectPath(salonId);
  } catch {
    return false;
  }
}

export async function uploadSalonAvatarFile(input: {
  salonId: string;
  file: File;
}): Promise<{ salonAvatarUrl: string }> {
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  const currentUser = auth?.currentUser;
  if (!currentUser || !storage) {
    throw new Error("Bạn cần đăng nhập chủ salon để tải ảnh đại diện lên");
  }

  const avatarBlob = await prepareSquareImage(input.file, {
    subject: "ảnh đại diện salon",
  });
  const avatarRef = ref(storage, salonAvatarObjectPath(input.salonId));
  await uploadBytes(avatarRef, avatarBlob, {
    contentType: "image/webp",
    customMetadata: {
      salonId: input.salonId,
      ownerUid: currentUser.uid,
    },
  });

  const salonAvatarUrl = await getDownloadURL(avatarRef);
  const bucketName = String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "");
  if (!isSalonAvatarDownloadUrl(salonAvatarUrl, bucketName, input.salonId)) {
    throw new Error("Ảnh đại diện không thuộc đúng vùng lưu trữ của salon");
  }

  return callFunction<{ salonId: string; salonAvatarUrl: string }, { salonAvatarUrl: string }>(
    "updateSalonAvatar",
    { salonId: input.salonId, salonAvatarUrl },
  );
}

export async function removeSalonAvatar(salonId: string) {
  return callFunction<{ salonId: string; salonAvatarUrl: string }, { salonAvatarUrl: string }>(
    "updateSalonAvatar",
    { salonId, salonAvatarUrl: "" },
  );
}
