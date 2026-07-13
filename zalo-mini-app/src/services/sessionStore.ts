import { AppSession, QrContext } from "./types";

const SESSION_KEY = "haircut_app_session_v1";

export function loadSavedSession(currentQr: QrContext): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const session = sanitizeSession(JSON.parse(raw) as AppSession);
    if (!isValidSession(session) || isDemoQr(session.qr)) {
      return null;
    }
    if (isProductionQr(currentQr) && session.qr.salonId !== currentQr.salonId) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function isProductionQr(qr: QrContext) {
  return (
    Boolean(qr.salonId && qr.qrToken) && qr.salonId !== "demo-salon" && qr.qrToken !== "demo-token"
  );
}

export function saveSession(session: AppSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sanitizeSession(session)));
}

export function clearSavedSession() {
  localStorage.removeItem(SESSION_KEY);
}

function sanitizeSession(session: AppSession): AppSession {
  const safeQr = { ...session.qr };
  delete safeQr.qrToken;
  const qrType =
    safeQr.qrType || (safeQr.mirrorId ? "legacy-mirror" : safeQr.branchId ? "branch" : "salon");
  return {
    ...session,
    qr: {
      qrType,
      salonId: safeQr.salonId || "",
      branchId: safeQr.branchId || "",
      mirrorId: safeQr.mirrorId || "",
    },
  };
}

function isDemoQr(qr: QrContext) {
  return qr.salonId === "demo-salon" || qr.mirrorId === "demo-mirror-1";
}

function isValidSession(value: AppSession | null): value is AppSession {
  return Boolean(
    value?.sessionId &&
    value?.zaloUserId &&
    value?.qr?.salonId &&
    (value?.qr?.branchId || value?.qr?.mirrorId) &&
    value?.customer?.customerId,
  );
}
