import type { QrContext } from "./types";

export function parseQrContext(): QrContext {
  const params = new URLSearchParams(window.location.search);

  return {
    salonId: params.get("salonId") || "demo-salon",
    mirrorId: params.get("mirrorId") || "demo-mirror-1",
    qrToken: params.get("qrToken") || "demo-token",
  };
}
