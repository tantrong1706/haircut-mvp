/// <reference types="vite/client" />

interface Window {
  __haircutBeforeSignOut?: () => Promise<void>;
  __haircutNativeShare?: (url: string, title: string) => Promise<void>;
}
