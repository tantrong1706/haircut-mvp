export const PRIVACY_PREFERENCES_KEY = "haircut_privacy_preferences_v1";
export const PRIVACY_PREFERENCES_EVENT = "haircut:privacy-preferences";
const VERSION = "2026-10-29";
const MAX_AGE_MS = 180 * 24 * 60 * 60_000;
let deniedInThisContext = false;

export type PrivacyPreferences = { version: string; optional: boolean; updatedAt: number };

export function readPrivacyPreferences(): PrivacyPreferences | null {
  if (deniedInThisContext) return null;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PRIVACY_PREFERENCES_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Partial<PrivacyPreferences>;
    if (
      value.version !== VERSION ||
      typeof value.optional !== "boolean" ||
      typeof value.updatedAt !== "number" ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt <= 0 ||
      value.updatedAt > Date.now() + 30_000 ||
      Date.now() - value.updatedAt > MAX_AGE_MS
    )
      return null;
    return { version: VERSION, optional: value.optional, updatedAt: value.updatedAt };
  } catch {
    return null;
  }
}

export function hasOptionalMonitoringConsent() {
  return readPrivacyPreferences()?.optional === true;
}

export function savePrivacyPreferences(optional: boolean): boolean {
  if (!optional) deniedInThisContext = true;
  let saved = false;
  try {
    localStorage.setItem(
      PRIVACY_PREFERENCES_KEY,
      JSON.stringify({ version: VERSION, optional, updatedAt: Date.now() }),
    );
    deniedInThisContext = false;
    saved = true;
  } catch {
    deniedInThisContext = true;
    /* Optional monitoring remains off when the choice cannot be recorded. */
  }
  if (!optional) {
    try {
      clearAnalyticsCookies();
    } catch {
      /* A blocked cookie API must not prevent opting out. */
    }
  }
  window.dispatchEvent(new Event(PRIVACY_PREFERENCES_EVENT));
  return saved;
}

function clearAnalyticsCookies() {
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`];
  if (host === "chhaircutsalon.cc" || host.endsWith(".chhaircutsalon.cc"))
    domains.push(".chhaircutsalon.cc");
  for (const part of document.cookie.split(";")) {
    const name = part.trim().split("=", 1)[0];
    if (!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/u.test(name)) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}
