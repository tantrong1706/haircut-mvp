export const MAX_HAIRCUT_PHOTOS = 3;
export const MAX_HAIRCUT_PHOTO_SIZE = 3 * 1024 * 1024;

export function storageObjectNameFromDownloadUrl(
  downloadUrl: string,
  bucketName: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(downloadUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "firebasestorage.googleapis.com") {
    return null;
  }

  const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) {
    return null;
  }

  try {
    const urlBucket = decodeURIComponent(match[1]);
    const objectName = decodeURIComponent(match[2]);
    if (urlBucket !== bucketName || !objectName || objectName.includes("\0")) {
      return null;
    }
    return objectName;
  } catch {
    return null;
  }
}

export function isExpectedHaircutPhotoPath(
  objectName: string,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  const prefix = `salons/${input.salonId}/customers/${input.customerId}/haircuts/${input.sessionId}/`;
  if (!objectName.startsWith(prefix)) {
    return false;
  }

  const fileName = objectName.slice(prefix.length);
  return /^photo-[A-Za-z0-9-]{12,80}\.jpg$/.test(fileName);
}
