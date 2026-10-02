export function isZaloMiniAppRuntime() {
  // Production on this branch is Web, including inside in-app browsers.
  // Legacy detection below is retained for existing development/test fixtures only.
  if (import.meta.env.VITE_APP_ENV === "production") {
    return false;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (import.meta.env.VITE_ZALO_PREVIEW === "true") {
    return true;
  }

  const runtimeWindow = window as Window & { ZJSBridge?: unknown };
  const userAgent = navigator.userAgent.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();

  return (
    Boolean(runtimeWindow.ZJSBridge) ||
    userAgent.includes("zalo") ||
    hostname.endsWith("h5.zdn.vn") ||
    hostname.includes("miniapp.zalo")
  );
}
