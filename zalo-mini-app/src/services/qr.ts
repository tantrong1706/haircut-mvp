import type { QrContext } from "./types";

export function parseQrContext(): QrContext {
  const params = new URLSearchParams(window.location.search);
  const previewEnabled = import.meta.env.VITE_ZALO_PREVIEW === "true";

  return {
    salonId:
      params.get("salonId") ||
      (previewEnabled ? import.meta.env.VITE_PREVIEW_SALON_ID || "" : "") ||
      "demo-salon",

    mirrorId:
      params.get("mirrorId") ||
      (previewEnabled ? import.meta.env.VITE_PREVIEW_MIRROR_ID || "" : "") ||
      "demo-mirror-1",

    qrToken:
      params.get("qrToken") ||
      (previewEnabled ? import.meta.env.VITE_PREVIEW_QR_TOKEN || "" : "") ||
      "demo-token",
  };
}

export function hasQrContext(): boolean {
  const qr = parseQrContext();

  return Boolean(
    qr.salonId &&
    qr.mirrorId &&
    qr.qrToken &&
    qr.salonId !== "demo-salon" &&
    qr.mirrorId !== "demo-mirror-1" &&
    qr.qrToken !== "demo-token",
  );
}
