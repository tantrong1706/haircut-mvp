import { DEFAULT_SYSTEM_FEATURES, type SystemFeatures } from "@haircut/contracts";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  callFunction,
  getFirebaseDb,
  getFunctionWriteMode,
  isFirebaseConfigured,
} from "./firebase";
import {
  AppSession,
  CustomerProfile,
  HaircutRecord,
  LuckyWheelConfig,
  QrContext,
  Reward,
  SpinResult,
  defaultLuckyWheelConfig,
} from "./types";
import { activeWheelSlots, normalizeLuckyWheelConfig } from "./wheel";
import { getZaloAccessToken, getZaloIdentity, ZaloIdentity } from "./zalo";
import { createSessionIdentityBinding, type SavedSessionCandidate } from "./sessionStore";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";
export { parseQrContext } from "./qr";

const SESSION_POINT_REQUEST_WINDOW_MS = 12 * 60 * 60 * 1000;

type RegisterInput = QrContext & {
  zaloAccessToken: string;
  zaloUserId?: string;
  phoneToken?: string;
  name: string;
  phone?: string;
  birthday?: string;
  allowPhoto: boolean;
};

type RegisterCustomerFunctionResult = {
  customerId: string;
  sessionId: string;
  branchId: string;
  branchName?: string;
  branchAddress?: string;
  sessionStatus?: AppSession["sessionStatus"];
  assignedStaffName?: string;
  claimedAtMs?: number | null;
  points: number;
  zaloUserId: string;
  phoneLast4?: string;
  features?: SystemFeatures;
};

type CustomerHistoryFunctionResult = {
  records: Array<{
    id: string;
    createdAtMs: number | null;
    salonName?: string;
    branchId?: string;
    branchName?: string;
    staffName: string;
    serviceName?: string;
    rewardName?: string;
    note: string;
    photoUrls: string[];
    pointsAdded: number;
  }>;
};

type CustomerRewardsFunctionResult = {
  rewards: Array<{
    id: string;
    rewardName: string;
    rewardCode: string;
    status: Reward["status"];
    sourceBranchId?: string;
    sourceBranchName?: string;
    redemptionScope?: "salon" | "branches";
    allowedBranchIds?: string[];
    createdAtMs: number | null;
    usedAtMs: number | null;
    usedBranchId?: string;
    usedBranchName?: string;
    expiresAtMs: number | null;
  }>;
};

type CustomerSessionFunctionResult = {
  identityBinding: string;
  sessionStatus: AppSession["sessionStatus"];
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  mirrorName?: string;
  assignedStaffName?: string;
  claimedAtMs?: number | null;
  customer: CustomerProfile;
  wheelConfig: LuckyWheelConfig;
  features?: SystemFeatures;
};

export type SavedSessionRestoreResult =
  | { status: "restored"; session: AppSession }
  | {
      status: "discarded";
      reason: "identity_mismatch" | "session_missing" | "terminal_session";
    };

export type CustomerQrBranch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};

export type CustomerQrResolution = {
  qrType: QrContext["qrType"];
  salonId: string;
  salonName: string;
  salonAvatarUrl: string;
  branchId: string | null;
  branchName: string;
  branchAddress: string;
  selectionRequired: boolean;
  branches: CustomerQrBranch[];
  features: SystemFeatures;
};

export function listenSessionLiveUpdates(
  session: AppSession,
  onChange: (session: AppSession) => void,
  onError?: (message: string) => void,
  onSynced?: (syncedAtMs: number) => void,
) {
  if (getFunctionWriteMode() === "required") {
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

  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return () => undefined;
  }

  let currentSession = session;

  function emit(next: AppSession) {
    currentSession = next;
    onChange(next);
  }

  const unsubSession = onSnapshot(
    doc(db, "chair_sessions", session.sessionId),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      emit({
        ...currentSession,
        sessionStatus: normalizeSessionStatus(
          snapshot.data().status,
          snapshot.data().assignedStaffId,
        ),
        assignedStaffName: String(snapshot.data().assignedStaffName || ""),
        claimedAtMs: toMillis(snapshot.data().claimedAt),
        branchName: String(snapshot.data().branchName || currentSession.branchName || ""),
        branchAddress: String(snapshot.data().branchAddress || currentSession.branchAddress || ""),
        mirrorName: String(
          snapshot.data().branchName ||
            snapshot.data().mirrorName ||
            currentSession.mirrorName ||
            "",
        ),
      });
      onSynced?.(Date.now());
    },
    (error) => onError?.(error.message),
  );

  const unsubCustomer = onSnapshot(
    doc(db, "customers", session.customer.customerId),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      emit({
        ...currentSession,
        customer: mapCustomerProfile(snapshot.id, snapshot.data(), currentSession.customer),
      });
      onSynced?.(Date.now());
    },
    (error) => onError?.(error.message),
  );

  return () => {
    unsubSession();
    unsubCustomer();
  };
}

export async function restoreSavedCustomerSession(
  candidate: SavedSessionCandidate,
): Promise<SavedSessionRestoreResult> {
  if (
    !isFirebaseConfigured() &&
    (import.meta.env.VITE_ZALO_PREVIEW === "true" || import.meta.env.VITE_APP_ENV === "test")
  ) {
    return restorePreviewCustomerSession(candidate);
  }

  let result: CustomerSessionFunctionResult;
  try {
    const zaloAccessToken = await getZaloAccessToken();
    result = await callFunction<
      { salonId: string; sessionId: string; zaloAccessToken: string },
      CustomerSessionFunctionResult
    >("getCustomerSessionFromZalo", {
      salonId: candidate.salonId,
      sessionId: candidate.sessionId,
      zaloAccessToken,
    });
  } catch (error) {
    if (isDefinitiveMissingSessionError(error)) {
      return { status: "discarded", reason: "session_missing" };
    }
    throw error;
  }

  if (
    result.identityBinding !== candidate.identityBinding ||
    result.customer.customerId !== candidate.customerId
  ) {
    return { status: "discarded", reason: "identity_mismatch" };
  }

  const sessionStatus = normalizeSessionStatus(result.sessionStatus, result.assignedStaffName);
  if (sessionStatus === "completed" || sessionStatus === "cancelled") {
    return { status: "discarded", reason: "terminal_session" };
  }

  return {
    status: "restored",
    session: {
      qr: candidate.qr,
      sessionId: candidate.sessionId,
      branchName: result.branchName || "",
      branchAddress: result.branchAddress || "",
      mirrorName: result.mirrorName || result.branchName || "",
      zaloUserId: "",
      identityBinding: result.identityBinding,
      sessionStatus,
      assignedStaffName: result.assignedStaffName || "",
      claimedAtMs: result.claimedAtMs ?? null,
      features: result.features ?? { ...DEFAULT_SYSTEM_FEATURES },
      customer: mapCustomerProfile(
        result.customer.customerId,
        result.customer as unknown as Record<string, unknown>,
        result.customer,
      ),
    },
  };
}

async function restorePreviewCustomerSession(
  candidate: SavedSessionCandidate,
): Promise<SavedSessionRestoreResult> {
  const identity =
    import.meta.env.VITE_APP_ENV === "test"
      ? {
          accessToken: "preview-access-token",
          zaloUserId: "preview-zalo-user",
          name: "Khách xem trước",
        }
      : await getZaloIdentity();
  if (!identity.zaloUserId) {
    return { status: "discarded", reason: "identity_mismatch" };
  }
  const identityBinding = await createSessionIdentityBinding(identity.zaloUserId);
  if (!identityBinding || identityBinding !== candidate.identityBinding) {
    return { status: "discarded", reason: "identity_mismatch" };
  }

  const session = mockRegisterCustomer({
    ...candidate.qr,
    zaloAccessToken: identity.accessToken,
    zaloUserId: identity.zaloUserId,
    name: identity.name,
    allowPhoto: false,
  });
  if (session.customer.customerId !== candidate.customerId) {
    return { status: "discarded", reason: "identity_mismatch" };
  }

  return {
    status: "restored",
    session: {
      ...session,
      sessionId: candidate.sessionId,
      identityBinding,
    },
  };
}

function isDefinitiveMissingSessionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLocaleLowerCase("vi") : "";
  return (
    message.includes("không tìm thấy dữ liệu cần xử lý") ||
    message.includes("lượt cắt không thuộc khách hàng này")
  );
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

async function getCustomerSessionState(
  session: AppSession,
): Promise<CustomerSessionFunctionResult> {
  const zaloAccessToken = await getZaloAccessToken();
  const result = await callFunction<
    { salonId: string; sessionId: string; zaloAccessToken: string },
    CustomerSessionFunctionResult
  >("getCustomerSessionFromZalo", {
    salonId: session.qr.salonId,
    sessionId: session.sessionId,
    zaloAccessToken,
  });

  return {
    identityBinding: result.identityBinding,
    sessionStatus: normalizeSessionStatus(result.sessionStatus, result.assignedStaffName),
    branchId: result.branchId,
    assignedStaffName: result.assignedStaffName || "",
    claimedAtMs: result.claimedAtMs ?? null,
    branchName: result.branchName || session.branchName || "",
    branchAddress: result.branchAddress || session.branchAddress || "",
    mirrorName: result.mirrorName || session.mirrorName || "",
    customer: mapCustomerProfile(
      result.customer.customerId || session.customer.customerId,
      result.customer as unknown as Record<string, unknown>,
      session.customer,
    ),
    wheelConfig: normalizeLuckyWheelConfig(result.wheelConfig),
    features: result.features,
  };
}

async function callCustomerFunctionOrDirect<TInput, TOutput>(
  name: string,
  payload: TInput,
  direct: () => Promise<TOutput>,
): Promise<TOutput> {
  const mode = getFunctionWriteMode();

  if (mode === "direct" || !isFirebaseConfigured()) {
    return direct();
  }

  try {
    return await callFunction<TInput, TOutput>(name, payload);
  } catch (error) {
    if (mode === "required") {
      throw error;
    }

    console.warn(`Cloud Function ${name} chưa sẵn sàng, dùng direct mode.`, error);
    return direct();
  }
}

export async function registerCustomer(input: RegisterInput): Promise<AppSession> {
  if (!isFirebaseConfigured()) {
    return mockRegisterCustomer(input);
  }

  const result = await callCustomerFunctionOrDirect<RegisterInput, RegisterCustomerFunctionResult>(
    "registerCustomerFromZalo",
    input,
    () => registerCustomerDirect(input),
  );

  return buildSessionFromRegisterResult(input, result);
}

export async function resolveCustomerQr(qr: QrContext): Promise<CustomerQrResolution> {
  if (!qr.qrToken) {
    throw new Error("QR không có mã xác thực");
  }
  if (!isFirebaseConfigured()) {
    const previewBranches = [
      {
        id: "demo-branch-main",
        name: "Chi nhánh Trung tâm",
        address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
        phone: "0838098761",
        isActive: true,
      },
      {
        id: "demo-branch-two",
        name: "Chi nhánh Riverside",
        address: "28 Bến Vân Đồn, Quận 4, TP.HCM",
        phone: "0838098761",
        isActive: true,
      },
    ];
    const selectionRequired = qr.qrType === "salon" && !qr.branchId;
    const branchId = selectionRequired ? "" : qr.branchId || previewBranches[0].id;
    const selectedBranch = previewBranches.find((branch) => branch.id === branchId);
    return {
      qrType: qr.qrType,
      salonId: qr.salonId,
      salonName: "HAIRCUT Studio",
      salonAvatarUrl: "",
      branchId,
      branchName: selectedBranch?.name || "",
      branchAddress: selectedBranch?.address || "",
      selectionRequired,
      branches: previewBranches,
      features: { ...DEFAULT_SYSTEM_FEATURES },
    };
  }

  return callFunction<QrContext, CustomerQrResolution>("resolveCustomerQr", qr);
}

async function registerCustomerDirect(
  input: RegisterInput,
): Promise<RegisterCustomerFunctionResult> {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase chưa được cấu hình");
  }

  const phoneDigits = normalizePhone(input.phone);
  const zaloUserId =
    input.zaloUserId || `direct-${(await sha256Hex(input.zaloAccessToken)).slice(0, 24)}`;
  const branchId = input.branchId;
  if (!branchId) {
    throw new Error("Vui lòng chọn chi nhánh trước khi tạo lượt");
  }
  const customerId = await stableDocumentId(`${input.salonId}:${zaloUserId}`);
  const dailySessionId = await stableDocumentId(
    `${input.salonId}:${branchId}:${customerId}:${localDateKey()}`,
  );
  const customerRef = doc(db, "customers", customerId);
  const dailySessionRef = doc(db, "chair_sessions", dailySessionId);
  const fallbackSessionRef = doc(collection(db, "chair_sessions"));
  const name = input.name.trim() || "Khách hàng";

  const directResult = await runTransaction(db, async (transaction) => {
    const [customerSnap, dailySessionSnap] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(dailySessionRef),
    ]);
    let sessionRef = dailySessionRef;
    let sessionStatus: AppSession["sessionStatus"] = "waiting";
    const existingCustomer = customerSnap.exists() ? customerSnap.data() : {};
    const points = Math.max(0, Number(existingCustomer.points ?? 0));
    const effectivePhoneLast4 = phoneDigits
      ? phoneDigits.slice(-4)
      : String(existingCustomer.phoneLast4 || "");
    const customerSummary = {
      name,
      phoneLast4: effectivePhoneLast4,
      points,
      allowPhoto: input.allowPhoto,
    };
    const expiresAt = new Date(Date.now() + SESSION_POINT_REQUEST_WINDOW_MS);

    if (dailySessionSnap.exists()) {
      const currentStatus = normalizeSessionStatus(
        dailySessionSnap.data().status,
        dailySessionSnap.data().assignedStaffId,
      );
      const existingExpiresAtMs = toMillis(dailySessionSnap.data().expiresAt);
      const isOpenStatus =
        currentStatus === "waiting" ||
        currentStatus === "serving" ||
        currentStatus === "pending_approval";
      if (isOpenStatus && (existingExpiresAtMs === null || existingExpiresAtMs > Date.now())) {
        sessionStatus = currentStatus;
        transaction.set(
          dailySessionRef,
          { customerSummary, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } else {
        sessionRef = fallbackSessionRef;
        transaction.set(sessionRef, {
          salonId: input.salonId,
          branchId,
          branchName: branchId,
          qrType: input.qrType,
          legacyMirrorId: input.mirrorId || null,
          customerId,
          customerSummary,
          status: "waiting",
          isOpen: true,
          expiresAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      transaction.set(sessionRef, {
        salonId: input.salonId,
        branchId,
        branchName: branchId,
        qrType: input.qrType,
        legacyMirrorId: input.mirrorId || null,
        customerId,
        customerSummary,
        status: "waiting",
        isOpen: true,
        expiresAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const baseCustomer = {
      salonId: input.salonId,
      zaloUserId,
      source: "zalo_direct",
      name,
      nameSearch: normalizeSearchText(name),
      ...(phoneDigits ? { phone: phoneDigits, phoneLast4: phoneDigits.slice(-4) } : {}),
      ...(input.birthday?.trim() ? { birthday: input.birthday.trim() } : {}),
      allowPhoto: input.allowPhoto,
      activeSessionId: sessionRef.id,
      lastBranchId: branchId,
      updatedAt: serverTimestamp(),
    };

    if (customerSnap.exists()) {
      transaction.set(customerRef, baseCustomer, { merge: true });
    } else {
      transaction.set(customerRef, {
        phone: null,
        phoneLast4: null,
        birthday: null,
        ...baseCustomer,
        points: 0,
        createdAt: serverTimestamp(),
      });
    }

    return {
      sessionId: sessionRef.id,
      sessionStatus,
      points,
    };
  });

  return {
    customerId,
    sessionId: directResult.sessionId,
    branchId,
    branchName: branchId,
    branchAddress: "",
    sessionStatus: directResult.sessionStatus,
    points: directResult.points,
    zaloUserId,
  };
}

export async function spinWheel(
  session: AppSession,
  configVersion: number,
): Promise<SpinResult> {
  if (!isFirebaseConfigured()) {
    return spinWheelDirect(session, configVersion);
  }

  const zaloAccessToken = await getZaloAccessToken();
  const pendingSpin = getOrCreateIdempotencyKey(
    `spin:${session.qr.salonId}:${session.customer.customerId}`,
  );
  const result = await callFunction<
    {
      salonId: string;
      zaloAccessToken: string;
      idempotencyKey: string;
      configVersion: number;
    },
    SpinResult
  >("spinLuckyWheelFromZalo", {
    salonId: session.qr.salonId,
    zaloAccessToken,
    idempotencyKey: pendingSpin.key,
    configVersion,
  });
  safeStorageRemove(pendingSpin.storageKey);
  return {
    ...result,
    isWinning: result.isWinning ?? Boolean(result.rewardCode),
  };
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

async function spinWheelDirect(
  session: AppSession,
  configVersion: number,
): Promise<SpinResult> {
  const activeSlots = activeWheelSlots(defaultLuckyWheelConfig);
  const forcedIndexValue = safeStorageGet("haircut_mock_spin_index");
  const forcedIndex =
    import.meta.env.VITE_APP_ENV === "test" && forcedIndexValue !== null
      ? Number(forcedIndexValue)
      : Number.NaN;
  const selectedIndex =
    Number.isInteger(forcedIndex) && forcedIndex >= 0 && forcedIndex < activeSlots.length
      ? forcedIndex
      : Math.min(1, activeSlots.length - 1);
  const pointsAfter = Math.max(0, session.customer.points - defaultLuckyWheelConfig.requiredPoints);
  const selectedSlot = activeSlots[selectedIndex];
  const isWinning = selectedSlot?.type !== "no_prize";
  const reward = {
    rewardId: `reward-${Date.now()}`,
    rewardName: selectedSlot?.label || "Gội đầu miễn phí",
    rewardCode: isWinning ? makeRewardCode() : "",
    pointsAfter,
    isWinning,
    selectedIndex,
    selectedSlotId: selectedSlot?.slotId || "",
    configVersion,
  };

  if (isWinning) {
    saveMockReward({
      id: reward.rewardId,
      rewardName: reward.rewardName,
      rewardCode: reward.rewardCode,
      status: "unused",
      createdAt: new Date().toISOString(),
      redemptionScope: "salon",
      allowedBranchIds: [],
    });
  }

  safeStorageSet("haircut_mock_points", String(pointsAfter));
  return reward;
}

export async function getHaircutHistory(session: AppSession): Promise<HaircutRecord[]> {
  if (!isFirebaseConfigured() || getFunctionWriteMode() === "direct") {
    return getHaircutHistoryDirect(session);
  }

  const zaloAccessToken = await getZaloAccessToken();
  try {
    const result = await callFunction<
      { salonId: string; zaloAccessToken: string; limit: number },
      CustomerHistoryFunctionResult
    >("getCustomerHistoryFromZalo", {
      salonId: session.qr.salonId,
      zaloAccessToken,
      limit: 20,
    });

    return result.records.map((record) => ({
      id: record.id,
      createdAt: formatDate(record.createdAtMs),
      salonName: record.salonName || "",
      branchId: record.branchId || "",
      branchName: record.branchName || "",
      staffName: record.staffName || "",
      serviceName: record.serviceName || "",
      rewardName: record.rewardName || "",
      note: record.note || "",
      photoUrls: Array.isArray(record.photoUrls) ? record.photoUrls : [],
      pointsAdded: Number(record.pointsAdded ?? 0),
    }));
  } catch (error) {
    if (getFunctionWriteMode() === "required") {
      throw error;
    }

    console.warn("Không tải được lịch sử qua Functions, dùng direct mode.", error);
    return getHaircutHistoryDirect(session);
  }
}

async function getHaircutHistoryDirect(session: AppSession): Promise<HaircutRecord[]> {
  if (!isFirebaseConfigured()) {
    return [
      {
        id: "record-1",
        createdAt: "20/06/2026",
        staffName: "Nam",
        note: "Fade thấp, để mái dài, không cắt quá cao",
        photoUrls: [],
        pointsAdded: 1,
      },
    ];
  }

  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  const q = query(
    collection(db, "haircut_records"),
    where("salonId", "==", session.qr.salonId),
    where("customerId", "==", session.customer.customerId),
    firestoreLimit(20),
  );

  const [snap, salonSnap] = await Promise.all([
    getDocs(q),
    getDoc(doc(db, "salons", session.qr.salonId)),
  ]);
  const salonName = salonSnap.exists() ? String(salonSnap.data().name || "") : "";

  return snap.docs
    .map((item) => {
      const data = item.data();
      const createdAtMs = toMillis(data.createdAt);

      return {
        createdAtMs,
        record: {
          id: item.id,
          createdAt: formatDate(createdAtMs),
          salonName,
          branchId: String(data.branchId || ""),
          branchName: String(data.branchName || ""),
          staffName: data.staffName || "",
          serviceName: String(data.serviceName || ""),
          rewardName: String(data.rewardName || ""),
          note: data.note || "",
          photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
          pointsAdded: Number(data.pointsAdded ?? 0),
        },
      };
    })
    .sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0))
    .slice(0, 20)
    .map((item) => item.record);
}

export async function getCustomerWheelConfig(session: AppSession): Promise<LuckyWheelConfig> {
  if (!isFirebaseConfigured()) {
    return defaultLuckyWheelConfig;
  }

  if (getFunctionWriteMode() === "required") {
    return (await getCustomerSessionState(session)).wheelConfig;
  }

  const db = getFirebaseDb();

  if (!db) {
    return defaultLuckyWheelConfig;
  }

  const snap = await getDoc(doc(db, "lucky_wheel", session.qr.salonId));

  return snap.exists() ? normalizeLuckyWheelConfig(snap.data()) : defaultLuckyWheelConfig;
}

export async function getRewards(session: AppSession): Promise<Reward[]> {
  if (!isFirebaseConfigured() || getFunctionWriteMode() === "direct") {
    return getRewardsDirect(session);
  }

  const zaloAccessToken = await getZaloAccessToken();
  try {
    const result = await callFunction<
      { salonId: string; zaloAccessToken: string; limit: number },
      CustomerRewardsFunctionResult
    >("getCustomerRewardsFromZalo", {
      salonId: session.qr.salonId,
      zaloAccessToken,
      limit: 20,
    });

    return result.rewards.map((reward) => ({
      id: reward.id,
      rewardName: reward.rewardName || "",
      rewardCode: reward.rewardCode || "",
      status: normalizeRewardStatus(reward.status),
      sourceBranchId: reward.sourceBranchId || "",
      sourceBranchName: reward.sourceBranchName || "Chi nhánh phát hành",
      redemptionScope: reward.redemptionScope === "branches" ? "branches" : "salon",
      allowedBranchIds: Array.isArray(reward.allowedBranchIds) ? reward.allowedBranchIds : [],
      createdAt: formatDate(reward.createdAtMs),
      usedAt: formatDate(reward.usedAtMs),
      usedBranchId: reward.usedBranchId || "",
      usedBranchName: reward.usedBranchName || "",
      expiresAt: formatDate(reward.expiresAtMs),
    }));
  } catch (error) {
    if (getFunctionWriteMode() === "required") {
      throw error;
    }

    console.warn("Không tải được quà qua Functions, dùng direct mode.", error);
    return getRewardsDirect(session);
  }
}

async function getRewardsDirect(session: AppSession): Promise<Reward[]> {
  if (!isFirebaseConfigured()) {
    return getMockRewards();
  }

  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  const q = query(
    collection(db, "reward_history"),
    where("salonId", "==", session.qr.salonId),
    where("customerId", "==", session.customer.customerId),
    firestoreLimit(20),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((item) => {
      const data = item.data();
      const createdAtMs = toMillis(data.createdAt);
      const expiresAtMs = toMillis(data.expiresAt);

      return {
        createdAtMs,
        status: data.status,
        reward: {
          id: item.id,
          rewardName: data.rewardName || "",
          rewardCode: data.rewardCode || "",
          status: normalizeRewardStatus(data.status, expiresAtMs),
          sourceBranchId: String(data.sourceBranchId || data.branchId || ""),
          sourceBranchName: String(
            data.sourceBranchName || data.branchName || "Chi nhánh phát hành",
          ),
          redemptionScope:
            data.redemptionScope === "branches" ? ("branches" as const) : ("salon" as const),
          allowedBranchIds: Array.isArray(data.allowedBranchIds) ? data.allowedBranchIds : [],
          createdAt: formatDate(createdAtMs),
          usedAt: formatDate(toMillis(data.usedAt)),
          usedBranchId: String(data.usedBranchId || ""),
          usedBranchName: String(data.usedBranchName || ""),
          expiresAt: formatDate(expiresAtMs),
        },
      };
    })
    .filter((item) => item.status !== "no_prize")
    .sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0))
    .slice(0, 20)
    .map((item) => item.reward);
}

export function buildRegisterInput(
  qr: QrContext,
  identity: ZaloIdentity,
  allowPhoto: boolean,
  phone?: string,
  phoneToken?: string,
): RegisterInput {
  const input: RegisterInput = {
    ...qr,
    zaloAccessToken: identity.accessToken,
    name: identity.name,
    allowPhoto,
  };

  if (identity.zaloUserId) input.zaloUserId = identity.zaloUserId;
  if (phoneToken) input.phoneToken = phoneToken;
  if (phone) input.phone = phone;

  return input;
}

function mockRegisterCustomer(input: RegisterInput): AppSession {
  const existing = safeStorageGet("haircut_mock_points");
  const points = existing ? Number(existing) : 4;
  const previewStatusValue = safeStorageGet("haircut_mock_session_status");
  const previewStatus: AppSession["sessionStatus"] =
    import.meta.env.VITE_APP_ENV === "test" &&
    (previewStatusValue === "serving" || previewStatusValue === "completed")
      ? previewStatusValue
      : "waiting";

  return {
    qr: {
      qrType: input.qrType,
      salonId: input.salonId,
      branchId: input.branchId,
      mirrorId: input.mirrorId,
    },
    sessionId: "mock-session",
    branchName: input.branchId || "Chi nhánh chính",
    branchAddress: "",
    mirrorName: input.branchId || input.mirrorId,
    zaloUserId: "mock-local-zalo-user",
    sessionStatus: previewStatus,
    assignedStaffName: previewStatus === "waiting" ? "" : "Nhân viên Nam",
    claimedAtMs: previewStatus === "waiting" ? null : Date.now() - 10 * 60 * 1000,
    features: { ...DEFAULT_SYSTEM_FEATURES },
    customer: {
      customerId: "mock-customer",
      name: input.name,
      phoneLast4: input.phone?.slice(-4) || "1234",
      points,
      allowPhoto: input.allowPhoto,
    },
  };
}

function buildSessionFromRegisterResult(
  input: RegisterInput,
  result: RegisterCustomerFunctionResult,
): AppSession {
  const phoneDigits = normalizePhone(input.phone);

  return {
    qr: {
      qrType: input.qrType,
      salonId: input.salonId,
      branchId: result.branchId || input.branchId,
      mirrorId: input.mirrorId,
    },
    sessionId: result.sessionId,
    branchName: result.branchName || "",
    branchAddress: result.branchAddress || "",
    mirrorName: result.branchName || "",
    zaloUserId: result.zaloUserId,
    sessionStatus: result.sessionStatus || "waiting",
    assignedStaffName: result.assignedStaffName || "",
    claimedAtMs: result.claimedAtMs ?? null,
    features: result.features ?? { ...DEFAULT_SYSTEM_FEATURES },
    customer: {
      customerId: result.customerId,
      name: input.name || "Khách hàng",
      phoneLast4:
        result.phoneLast4 || (phoneDigits ? phoneDigits.slice(-4) : input.phone?.slice(-4) || ""),
      points: Number(result.points ?? 0),
      allowPhoto: input.allowPhoto,
    },
  };
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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMockRewards(): Reward[] {
  try {
    return JSON.parse(safeStorageGet("haircut_mock_rewards") || "[]");
  } catch {
    return [];
  }
}

function saveMockReward(reward: Reward) {
  const rewards = getMockRewards();
  safeStorageSet("haircut_mock_rewards", JSON.stringify([reward, ...rewards]));
}

function makeRewardCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0");
  return `HC-${date}-${random}`;
}

function normalizeRewardStatus(
  status: unknown,
  expiresAtMs: number | null = null,
): Reward["status"] {
  if (status === "used" || status === "expired" || status === "revoked") {
    return status;
  }

  if (expiresAtMs !== null && expiresAtMs <= Date.now()) {
    return "expired";
  }

  return "unused";
}

function formatDate(value: number | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function normalizePhone(phone?: string) {
  if (!phone) {
    return "";
  }

  return phone.replace(/\D/g, "");
}

async function stableDocumentId(value: string) {
  return (await sha256Hex(value)).slice(0, 40);
}

async function sha256Hex(value: string) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(16).padStart(40, "0");
}

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

function toMillis(value: any): number | null {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return null;
}
