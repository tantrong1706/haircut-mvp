type PhotoState = {
  photoUrls: string[];
  legacyPhotoUrls?: string[];
  photoPaths?: string[];
  photoReadUrls?: Record<string, string>;
};
export function legacyPhotoUrlsFor(request: PhotoState): string[] {
  if (request.legacyPhotoUrls) return request.legacyPhotoUrls;
  return request.photoUrls.slice(
    0,
    Math.max(0, request.photoUrls.length - (request.photoPaths?.length ?? 0)),
  );
}
export function storedPhotoCount(request: PhotoState): number {
  return legacyPhotoUrlsFor(request).length + (request.photoPaths?.length ?? 0);
}
export function photoItemsFor(request: PhotoState): Array<{ id: string; url: string }> {
  const legacy = legacyPhotoUrlsFor(request);
  const ids = [...legacy, ...(request.photoPaths ?? [])];
  return ids.flatMap((id, index) => {
    const url = request.photoReadUrls ? request.photoReadUrls[id] : request.photoUrls[index];
    return url ? [{ id, url }] : [];
  });
}
