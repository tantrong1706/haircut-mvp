/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_ADMIN_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_REGION?: string;
  readonly VITE_FUNCTION_WRITE_MODE?: string;
  readonly VITE_MONITORING_DISABLED?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAY_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_PHONE?: string;
  readonly VITE_ZALO_MINI_APP_ID?: string;
  readonly VITE_ZALO_PREVIEW?: string;
  readonly VITE_PREVIEW_SALON_ID?: string;
  readonly VITE_PREVIEW_MIRROR_ID?: string;
  readonly VITE_PREVIEW_QR_TOKEN?: string;
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

declare module "zmp-sdk/apis" {
  export function getAccessToken(): Promise<string>;

  export function openPermissionSetting(): Promise<void>;

  export function getUserInfo(options?: {
    autoRequestPermission?: boolean;
    avatarType?: "small" | "normal" | "large";
  }): Promise<{
    userInfo: {
      id: string;
      name: string;
      avatar?: string;
      followedOA?: boolean;
    };
  }>;
}
