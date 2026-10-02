export function safeStorageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key, value);
    return Boolean(globalThis.localStorage);
  } catch {
    return false;
  }
}

export function safeStorageRemove(key: string): boolean {
  try {
    globalThis.localStorage?.removeItem(key);
    return Boolean(globalThis.localStorage);
  } catch {
    return false;
  }
}
