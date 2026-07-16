export const SALON_AVATAR_MAX_UPLOAD_SIZE = 3 * 1024 * 1024;
export const SALON_AVATAR_CONTENT_TYPE = "image/webp";

export function salonAvatarObjectPath(salonId: string) {
  return `salons/${salonId}/branding/avatar.webp`;
}

export function isExpectedSalonAvatarPath(objectName: string, salonId: string) {
  return objectName === salonAvatarObjectPath(salonId);
}

export function isValidSalonAvatarMetadata(
  metadata: Record<string, unknown>,
  input: { salonId: string; ownerUid: string },
) {
  const size = Number(metadata.size ?? 0);
  const customMetadata =
    typeof metadata.metadata === "object" && metadata.metadata !== null
      ? (metadata.metadata as Record<string, unknown>)
      : {};

  return (
    size > 0 &&
    size <= SALON_AVATAR_MAX_UPLOAD_SIZE &&
    metadata.contentType === SALON_AVATAR_CONTENT_TYPE &&
    customMetadata.salonId === input.salonId &&
    customMetadata.ownerUid === input.ownerUid
  );
}
