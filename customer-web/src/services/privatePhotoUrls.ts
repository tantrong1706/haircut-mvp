import { callFunction } from "./firebase";

type PhotoContext = { salonId: string; customerId: string; sessionId: string };
type ReadInput = PhotoContext & { photoPaths: string[] };
function invalidPhoto(): never {
  throw new Error("Không thể tải liên kết ảnh an toàn. Vui lòng tải lại trang.");
}

function contextFor(path: string): PhotoContext | null {
  const match = path.match(
    /^salons\/([A-Za-z0-9_-]{1,128})\/customers\/([A-Za-z0-9_-]{1,128})\/(haircuts|sessions)\/([A-Za-z0-9_-]{1,128})\/(photo-[A-Za-z0-9-]{12,80}|op-[a-f0-9]{40})\.jpg$/,
  );
  if (
    !match ||
    (match[3] === "haircuts" ? !match[5].startsWith("photo-") : !match[5].startsWith("op-"))
  )
    return null;
  return { salonId: match[1], customerId: match[2], sessionId: match[4] };
}

export function legacyPhotoPathFromUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "firebasestorage.googleapis.com" ||
      !match ||
      !bucket ||
      decodeURIComponent(match[1]) !== bucket
    )
      return null;
    const path = decodeURIComponent(match[2]);
    return contextFor(path) && path.includes("/haircuts/") ? path : null;
  } catch {
    return null;
  }
}

export async function getPrivatePhotoUrls(input: ReadInput): Promise<Record<string, string>> {
  if (input.photoPaths.length === 0) return {};
  if (input.photoPaths.length > 3) invalidPhoto();
  const paths = [...new Set(input.photoPaths)];
  for (const path of paths) {
    const context = contextFor(path);
    if (
      !context ||
      context.salonId !== input.salonId ||
      context.customerId !== input.customerId ||
      context.sessionId !== input.sessionId
    )
      invalidPhoto();
  }
  const result = await callFunction<ReadInput, { photos: unknown; expiresAtMs: number }>(
    "getHaircutPhotoReadUrls",
    { ...input, photoPaths: paths },
  );
  if (
    !result ||
    !Array.isArray(result.photos) ||
    !Number.isFinite(result.expiresAtMs) ||
    result.expiresAtMs <= 0 ||
    result.photos.length !== paths.length
  )
    invalidPhoto();
  const urls: Record<string, string> = {};
  for (const entry of result.photos) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.path !== "string" ||
      typeof entry.url !== "string" ||
      !paths.includes(entry.path) ||
      urls[entry.path]
    )
      invalidPhoto();
    try {
      const parsed = new URL(entry.url);
      const objectPath = decodeURIComponent(parsed.pathname).split("/").slice(2).join("/");
      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "storage.googleapis.com" ||
        parsed.port ||
        parsed.username ||
        parsed.password ||
        parsed.searchParams.has("token") ||
        objectPath !== entry.path
      )
        invalidPhoto();
    } catch {
      invalidPhoto();
    }
    urls[entry.path] = entry.url;
  }
  return urls;
}

export async function getPrivatePhotoUrl(
  path: string,
  expected?: Partial<PhotoContext>,
): Promise<string> {
  const context = contextFor(path);
  if (
    !context ||
    (expected &&
      Object.entries(expected).some(([key, value]) => context[key as keyof PhotoContext] !== value))
  )
    invalidPhoto();
  const urls = await getPrivatePhotoUrls({ ...context, photoPaths: [path] });
  return urls[path];
}
