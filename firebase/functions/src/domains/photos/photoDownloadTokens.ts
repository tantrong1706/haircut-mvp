import type { File } from "@google-cloud/storage";

export const PRIVATE_PHOTO_CACHE_CONTROL = "private, no-store, max-age=0";

export function isPrivateHaircutObject(path: string): boolean {
  return (
    /^salons\/[A-Za-z0-9_-]{1,128}\/customers\/[A-Za-z0-9_-]{1,128}\/haircuts\/[A-Za-z0-9_-]{1,128}\/photo-[A-Za-z0-9-]{12,80}\.jpg$/.test(
      path,
    ) ||
    /^salons\/[A-Za-z0-9_-]{1,128}\/customers\/[A-Za-z0-9_-]{1,128}\/sessions\/[A-Za-z0-9_-]{1,128}\/op-[a-f0-9]{40}\.jpg$/.test(
      path,
    )
  );
}

/** Metadata-only, bounded and idempotent. Never delete/rewrite image bytes or avatars. */
export async function revokeHaircutDownloadTokens(file: File): Promise<boolean> {
  if (!isPrivateHaircutObject(file.name)) throw new Error("Not a scoped haircut photo");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [metadata] = await file.getMetadata();
      if (
        !metadata.metadata?.firebaseStorageDownloadTokens &&
        metadata.cacheControl === PRIVATE_PHOTO_CACHE_CONTROL
      )
        return false;
      const metageneration = String(metadata.metageneration ?? "");
      if (!/^[1-9][0-9]*$/.test(metageneration)) throw new Error("Missing photo metadata version");
      await file.setMetadata(
        {
          cacheControl: PRIVATE_PHOTO_CACHE_CONTROL,
          metadata: { firebaseStorageDownloadTokens: null },
        },
        { ifMetagenerationMatch: metageneration },
      );
      return true;
    } catch (error) {
      const code = Number((error as { code?: unknown }).code);
      if (code === 404) return false;
      if (code !== 412 || attempt === 2) throw error;
    }
  }
  throw new Error("Photo metadata update did not complete");
}
