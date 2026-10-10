import type {
  AppSession,
  CustomerProfile,
  HaircutRecord,
  LuckyWheelConfig,
  Reward,
  SpinResult,
} from "./types";
import { normalizeLuckyWheelConfig } from "./wheel";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";
import {
  getWebCustomerHistory,
  getWebCustomerRewards,
  getWebCustomerSessionState,
  spinWebCustomerWheel,
} from "./webCustomerApi";

// Cached legacy identity is not authentication. Firebase callable authorization remains server-side.
function requireWebSession(session: AppSession) {
  if (session.identityProvider !== "firebase") {
    throw new Error("Vui lòng đăng nhập bằng số điện thoại để tiếp tục.");
  }
}

export function listenSessionLiveUpdates(
  session: AppSession,
  onChange: (session: AppSession) => void,
  onError?: (message: string) => void,
  onSynced?: (syncedAtMs: number) => void,
) {
  requireWebSession(session);
  let stopped = false;
  let refreshing = false;
  let currentSession = session;
  let retryCount = 0;
  let timeoutId: number | undefined;

  const scheduleRefresh = () => {
    if (stopped) {
      return;
    }
    window.clearTimeout(timeoutId);
    const delay = customerSessionRefreshDelay(
      currentSession.sessionStatus,
      retryCount,
      Math.random(),
    );
    if (delay === null) {
      return;
    }
    timeoutId = window.setTimeout(() => void refresh(), delay);
  };

  const refresh = async () => {
    window.clearTimeout(timeoutId);
    if (stopped) {
      return;
    }
    if (refreshing || !navigator.onLine || document.visibilityState === "hidden") {
      scheduleRefresh();
      return;
    }

    refreshing = true;
    try {
      const state = await getCustomerSessionState(currentSession);
      const nextSession = {
        ...currentSession,
        sessionStatus: state.sessionStatus,
        assignedStaffName: state.assignedStaffName,
        claimedAtMs: state.claimedAtMs,
        branchName: state.branchName || currentSession.branchName,
        branchAddress: state.branchAddress || currentSession.branchAddress,
        mirrorName: state.mirrorName || currentSession.mirrorName,
        features: state.features ?? currentSession.features,
        customer: state.customer,
      };

      if (JSON.stringify(nextSession) !== JSON.stringify(currentSession)) {
        currentSession = nextSession;
        onChange(nextSession);
      }
      retryCount = 0;
      onSynced?.(Date.now());
    } catch (error) {
      retryCount = Math.min(retryCount + 1, 2);
      onError?.(error instanceof Error ? error.message : "Không đồng bộ được lượt cắt");
    } finally {
      refreshing = false;
      scheduleRefresh();
    }
  };

  const refreshWhenVisible = () => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  };
  window.addEventListener("focus", refreshWhenVisible);
  document.addEventListener("visibilitychange", refreshWhenVisible);
  void refresh();

  return () => {
    stopped = true;
    window.clearTimeout(timeoutId);
    window.removeEventListener("focus", refreshWhenVisible);
    document.removeEventListener("visibilitychange", refreshWhenVisible);
  };
}

export function customerSessionRefreshDelay(
  status: AppSession["sessionStatus"],
  retryCount: number,
  randomValue: number,
) {
  if (status === "completed" || status === "cancelled") {
    return null;
  }

  const baseDelay =
    retryCount > 0
      ? Math.min(90_000, 20_000 * 2 ** Math.min(retryCount, 3))
      : status === "pending_approval"
        ? 30_000
        : status === "serving"
          ? 24_000
          : 20_000;
  const safeRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999)
    : 0;
  return baseDelay + Math.floor(safeRandom * 5_000);
}

async function getCustomerSessionState(session: AppSession) {
  requireWebSession(session);
  const result = await getWebCustomerSessionState(session);
  return {
    sessionStatus: normalizeSessionStatus(result.sessionStatus, result.assignedStaffName),
    branchId: result.branchId,
    assignedStaffName: result.assignedStaffName || "",
    claimedAtMs: result.claimedAtMs ?? null,
    branchName: result.branchName || session.branchName || "",
    branchAddress: result.branchAddress || session.branchAddress || "",
    mirrorName: session.mirrorName || "",
    customer: mapCustomerProfile(
      result.customer.customerId || session.customer.customerId,
      result.customer as unknown as Record<string, unknown>,
      session.customer,
    ),
    wheelConfig: normalizeLuckyWheelConfig(result.wheelConfig),
    features: result.features,
  };
}

export async function getHaircutHistory(session: AppSession): Promise<HaircutRecord[]> {
  requireWebSession(session);
  return getWebCustomerHistory(session);
}

export async function getRewards(session: AppSession): Promise<Reward[]> {
  requireWebSession(session);
  return getWebCustomerRewards(session);
}

export async function getCustomerWheelConfig(session: AppSession): Promise<LuckyWheelConfig> {
  return (await getCustomerSessionState(session)).wheelConfig;
}

export async function spinWheel(session: AppSession, configVersion: number): Promise<SpinResult> {
  requireWebSession(session);
  const pendingSpin = getOrCreateIdempotencyKey(
    `spin:${session.qr.salonId}:${session.customer.customerId}`,
  );
  const result = await spinWebCustomerWheel(session, configVersion, pendingSpin.key);
  safeStorageRemove(pendingSpin.storageKey);
  return { ...result, isWinning: result.isWinning ?? Boolean(result.rewardCode) };
}

function getOrCreateIdempotencyKey(scope: string) {
  const storageKey = `haircut_pending_operation:${scope}`;
  const existing = safeStorageGet(storageKey);
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) {
    return { storageKey, key: existing };
  }
  const key =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${crypto.getRandomValues(new Uint32Array(4)).join("_")}`;
  safeStorageSet(storageKey, key);
  return { storageKey, key };
}

function mapCustomerProfile(
  customerId: string,
  data: Record<string, unknown>,
  fallback: CustomerProfile,
): CustomerProfile {
  return {
    customerId,
    name: String(data.name || fallback.name || "Khách hàng"),
    phoneLast4: String(data.phoneLast4 || fallback.phoneLast4 || ""),
    points: Number(data.points ?? fallback.points ?? 0),
    allowPhoto: Boolean(data.allowPhoto ?? fallback.allowPhoto),
    nextPointEligibleAtMs:
      typeof data.nextPointEligibleAtMs === "number" ? data.nextPointEligibleAtMs : undefined,
  };
}

function normalizeSessionStatus(
  value: unknown,
  assignedStaffId?: unknown,
): AppSession["sessionStatus"] {
  if (value === "serving" && !assignedStaffId) {
    return "pending_approval";
  }
  if (
    value === "serving" ||
    value === "pending_approval" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "waiting";
}
