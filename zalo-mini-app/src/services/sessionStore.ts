import { safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";
import type { AppSession, QrContext, QrType } from "./types";

const SESSION_KEY = "haircut_customer_session_v2";
const LEGACY_SESSION_KEY = "haircut_app_session_v1";
const SESSION_SCHEMA_VERSION = 2;
const IDENTITY_BINDING_PATTERN = /^[a-f0-9]{64}$/;

export const SESSION_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export type SavedSessionCandidate = {
  schemaVersion: 2;
  salonId: string;
  sessionId: string;
  customerId: string;
  identityBinding: string;
  savedAt: number;
  expiresAt: number;
  qr: {
    qrType: QrType;
    salonId: string;
    branchId: string;
    mirrorId: string;
  };
};

let saveGeneration = 0;

export function loadSavedSessionCandidate(currentQr: QrContext): SavedSessionCandidate | null {
  safeStorageRemove(LEGACY_SESSION_KEY);
  const raw = safeStorageGet(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!isValidCandidate(candidate) || candidate.expiresAt <= Date.now()) {
      clearSavedSession();
      return null;
    }
    if (isDemoQr(candidate.qr)) {
      clearSavedSession();
      return null;
    }
    if (currentQr.salonId && candidate.salonId !== currentQr.salonId) {
      clearSavedSession();
      return null;
    }

    return candidate;
  } catch {
    clearSavedSession();
    return null;
  }
}

export async function saveSession(session: AppSession): Promise<boolean> {
  if (session.sessionStatus === "completed" || session.sessionStatus === "cancelled") {
    clearSavedSession();
    return false;
  }

  const generation = ++saveGeneration;
  const identityBinding = isIdentityBinding(session.identityBinding)
    ? session.identityBinding
    : await createSessionIdentityBinding(session.zaloUserId);

  if (generation !== saveGeneration || !identityBinding) {
    return false;
  }

  const savedAt = Date.now();
  const candidate: SavedSessionCandidate = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    salonId: session.qr.salonId,
    sessionId: session.sessionId,
    customerId: session.customer.customerId,
    identityBinding,
    savedAt,
    expiresAt: savedAt + SESSION_CACHE_TTL_MS,
    qr: {
      qrType: session.qr.qrType,
      salonId: session.qr.salonId,
      branchId: session.qr.branchId || "",
      mirrorId: session.qr.mirrorId || "",
    },
  };

  if (!isValidCandidate(candidate)) {
    return false;
  }
  return safeStorageSet(SESSION_KEY, JSON.stringify(candidate));
}

export function clearSavedSession() {
  saveGeneration += 1;
  safeStorageRemove(SESSION_KEY);
  safeStorageRemove(LEGACY_SESSION_KEY);
}

export async function createSessionIdentityBinding(value: string): Promise<string | null> {
  const identity = value.trim();
  if (!identity || !globalThis.crypto?.subtle) {
    return null;
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidCandidate(value: unknown): value is SavedSessionCandidate {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SavedSessionCandidate>;
  const qr = candidate.qr;
  return Boolean(
    candidate.schemaVersion === SESSION_SCHEMA_VERSION &&
      isNonEmptyString(candidate.salonId) &&
      isNonEmptyString(candidate.sessionId) &&
      isNonEmptyString(candidate.customerId) &&
      isIdentityBinding(candidate.identityBinding) &&
      isFiniteTimestamp(candidate.savedAt) &&
      isFiniteTimestamp(candidate.expiresAt) &&
      candidate.expiresAt! > candidate.savedAt! &&
      qr &&
      isQrType(qr.qrType) &&
      qr.salonId === candidate.salonId &&
      (isNonEmptyString(qr.branchId) || isNonEmptyString(qr.mirrorId)),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIdentityBinding(value: unknown): value is string {
  return typeof value === "string" && IDENTITY_BINDING_PATTERN.test(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isQrType(value: unknown): value is QrType {
  return value === "salon" || value === "branch" || value === "legacy-mirror";
}

function isDemoQr(qr: SavedSessionCandidate["qr"]) {
  return qr.salonId === "demo-salon" || qr.mirrorId === "demo-mirror-1";
}
