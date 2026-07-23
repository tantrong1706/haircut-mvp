/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string;
  readonly VITE_APP_CHECK_DEBUG_TOKEN?: string;
  readonly VITE_FIREBASE_REGION?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_PUBLIC_WEB_URL?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __haircutBeforeSignOut?: () => Promise<void>;
  __haircutNativeShare?: (url: string, title: string) => Promise<void>;
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
}
