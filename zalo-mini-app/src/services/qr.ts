import type { QrContext } from "./types";

let cachedQr: { url: string; context: QrContext } | null = null;

type QrEnvironment = {
  previewEnabled: boolean;
  demoEnabled: boolean;
  previewSalonId?: string;
  previewMirrorId?: string;
  previewQrToken?: string;
};

export function parseQrContext(): QrContext {
  const currentUrl = relativeUrl();
  if (cachedQr?.url === currentUrl) {
    return cachedQr.context;
  }

  const previewEnabled = import.meta.env.VITE_ZALO_PREVIEW === "true";
  const context = resolveQrContext(window.location.search, {
    previewEnabled,
    demoEnabled: import.meta.env.DEV,
    previewSalonId: import.meta.env.VITE_PREVIEW_SALON_ID,
    previewMirrorId: import.meta.env.VITE_PREVIEW_MIRROR_ID,
    previewQrToken: import.meta.env.VITE_PREVIEW_QR_TOKEN,
  });

  removeQrTokenFromUrl();
  cachedQr = { url: relativeUrl(), context };
  return context;
}

export function resolveQrContext(search: string, environment: QrEnvironment): QrContext {
  const params = new URLSearchParams(search);
  const mirrorId =
    params.get("mirrorId") ||
    (environment.previewEnabled ? environment.previewMirrorId || "" : "") ||
    (environment.demoEnabled ? "demo-mirror-1" : "");
  const branchId = params.get("branchId") || "";
  const requestedType = params.get("qrType");
  const qrType =
    requestedType === "salon" || requestedType === "branch"
      ? requestedType
      : mirrorId
        ? "legacy-mirror"
        : branchId
          ? "branch"
          : "salon";

  const context: QrContext = {
    qrType,
    salonId:
      params.get("salonId") ||
      (environment.previewEnabled ? environment.previewSalonId || "" : "") ||
      (environment.demoEnabled ? "demo-salon" : ""),
    branchId,
    mirrorId,
    qrToken:
      params.get("qrToken") ||
      (environment.previewEnabled ? environment.previewQrToken || "" : "") ||
      (environment.demoEnabled ? "demo-token" : ""),
  };
  return context;
}

export function hasQrContext(qr = parseQrContext()): boolean {
  const targetIsValid = qr.qrType === "salon" || (qr.qrType === "branch" && Boolean(qr.branchId));

  return Boolean(
    qr.salonId &&
    qr.qrToken &&
    targetIsValid &&
    qr.salonId !== "demo-salon" &&
    qr.qrToken !== "demo-token",
  );
}

function removeQrTokenFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("qrToken")) {
    return;
  }
  url.searchParams.delete("qrToken");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function relativeUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
