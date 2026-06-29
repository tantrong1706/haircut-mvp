import { AppSession, QrContext } from "./types";

const SESSION_KEY = "haircut_app_session_v1";

export function loadSavedSession(currentQr: QrContext): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as AppSession;
    if (!isValidSession(session) || !sameQr(session.qr, currentQr)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: AppSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSavedSession() {
  localStorage.removeItem(SESSION_KEY);
}

function sameQr(left: QrContext, right: QrContext) {
  return (
    left.salonId === right.salonId &&
    left.mirrorId === right.mirrorId &&
    left.qrToken === right.qrToken
  );
}

function isValidSession(value: AppSession | null): value is AppSession {
  return Boolean(
    value?.sessionId &&
      value?.zaloUserId &&
      value?.qr?.salonId &&
      value?.qr?.mirrorId &&
      value?.customer?.customerId,
  );
}
