import { isZaloMiniAppRuntime } from "./runtime";

export function registerServiceWorker() {
  if (
    !("serviceWorker" in navigator) ||
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === "test" ||
    isZaloMiniAppRuntime() ||
    !["http:", "https:"].includes(window.location.protocol)
  ) {
    return;
  }

  window.addEventListener("load", () => {
    const buildAsset = new URL(import.meta.url).pathname.split("/").pop() || "local";
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(buildAsset)}`;

    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn("Không đăng ký được service worker.", error);
    });
  });
}
