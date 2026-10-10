import type { QrContext } from "./types";

let cachedQr: { url: string; context: QrContext } | null = null;

type QrEnvironment = {
  demoEnabled: boolean;
};

export function parseQrContext(): QrContext {
  const currentUrl = relativeUrl();
  if (cachedQr?.url === currentUrl) {
    return cachedQr.context;
  }

  const context = resolveQrContext(window.location.search, {
    demoEnabled: import.meta.env.DEV,
  });

  removeQrTokenFromUrl();
  cachedQr = { url: relativeUrl(), context };
  return context;
}

export function resolveQrContext(search: string, environment: QrEnvironment): QrContext {
  const params = new URLSearchParams(search);
  const mirrorId = params.get("mirrorId") || (environment.demoEnabled ? "demo-mirror-1" : "");
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
    salonId: params.get("salonId") || (environment.demoEnabled ? "demo-salon" : ""),
    branchId,
    mirrorId,
    qrToken: params.get("qrToken") || (environment.demoEnabled ? "demo-token" : ""),
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
