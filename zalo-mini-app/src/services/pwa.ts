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
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Không đăng ký được service worker.", error);
    });
  });
}
