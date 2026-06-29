import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { callFunctionOrFallback, callWriteFunctionOrFallback } from "./functionWrites";
import { callFunction, getFirebaseDb, getFunctionWriteMode, isFirebaseConfigured } from "./firebase";
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
import { ZaloIdentity } from "./zalo";

type RegisterInput = QrContext & {
  zaloUserId: string;
  name: string;
  phone?: string;
  birthday?: string;
  allowPhoto: boolean;
};

type RegisterCustomerFunctionResult = {
  customerId: string;
  sessionId: string;
  points: number;
};

type CustomerHistoryFunctionResult = {
  records: Array<{
    id: string;
    createdAtMs: number | null;
    staffName: string;
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
    createdAtMs: number | null;
  }>;
};

export function listenSessionLiveUpdates(
  session: AppSession,
  onChange: (session: AppSession) => void,
  onError?: (message: string) => void,
) {
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
        sessionStatus: normalizeSessionStatus(snapshot.data().status),
      });
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
        customer: mapCustomerProfile(
          snapshot.id,
          snapshot.data(),
          currentSession.customer,
        ),
      });
    },
    (error) => onError?.(error.message),
  );

  return () => {
    unsubSession();
    unsubCustomer();
  };
}

export async function registerCustomer(input: RegisterInput): Promise<AppSession> {
  const mode = getFunctionWriteMode();

  if (mode !== "direct") {
    try {
      const result = await callFunction<RegisterInput, RegisterCustomerFunctionResult>(
        "registerCustomerFromZalo",
        input,
      );

      return buildSessionFromRegisterResult(input, result);
    } catch (error) {
      if (mode === "required") {
        throw error;
      }

      console.warn(
        "Cloud Function registerCustomerFromZalo lỗi, dùng luồng Firestore trực tiếp để test nội bộ.",
        error,
      );
    }
  }

  return registerCustomerDirect(input);
}

async function registerCustomerDirect(input: RegisterInput): Promise<AppSession> {
  if (!isFirebaseConfigured()) {
    return mockRegisterCustomer(input);
  }

  const db = getFirebaseDb();

  if (!db) {
    return mockRegisterCustomer(input);
  }

  const phoneDigits = normalizePhone(input.phone);
  const customerId = makeCustomerId(input.salonId, input.zaloUserId, phoneDigits);
  const customerRef = doc(db, "customers", customerId);
  const customerSnap = await getDoc(customerRef);

  const existingData = customerSnap.exists() ? customerSnap.data() : null;
  const points = Number(existingData?.points ?? 0);

  await setDoc(
    customerRef,
    {
      salonId: input.salonId,
      zaloUserId: input.zaloUserId,
      name: input.name || "Khách hàng",
      phone: phoneDigits || input.phone || "",
      phoneLast4: phoneDigits ? phoneDigits.slice(-4) : input.phone?.slice(-4) || "",
      birthday: input.birthday || "",
      points,
      allowPhoto: input.allowPhoto,
      updatedAt: serverTimestamp(),
      createdAt: existingData?.createdAt || serverTimestamp(),
    },
    { merge: true },
  );

  const sessionRef = await addDoc(collection(db, "chair_sessions"), {
    salonId: input.salonId,
    mirrorId: input.mirrorId,
    qrToken: input.qrToken,
    customerId,
    zaloUserId: input.zaloUserId,
    status: "waiting",
    createdAt: serverTimestamp(),
  });

  return {
    qr: {
      salonId: input.salonId,
      mirrorId: input.mirrorId,
      qrToken: input.qrToken,
    },
    sessionId: sessionRef.id,
    zaloUserId: input.zaloUserId,
    sessionStatus: "waiting",
    customer: {
      customerId,
      name: input.name || "Khách hàng",
      phoneLast4: phoneDigits ? phoneDigits.slice(-4) : input.phone?.slice(-4) || "",
      points,
      allowPhoto: input.allowPhoto,
    },
  };
}

export async function spinWheel(session: AppSession): Promise<SpinResult> {
  return callWriteFunctionOrFallback(
    "spinLuckyWheelFromZalo",
    {
      salonId: session.qr.salonId,
      zaloUserId: session.zaloUserId,
    },
    () => spinWheelDirect(session),
  );
}

async function spinWheelDirect(session: AppSession): Promise<SpinResult> {
  if (!isFirebaseConfigured()) {
    const activeSlots = activeWheelSlots(defaultLuckyWheelConfig);
    const selectedIndex = Math.min(1, activeSlots.length - 1);
    const pointsAfter = Math.max(
      0,
      session.customer.points - defaultLuckyWheelConfig.requiredPoints,
    );
    const reward = {
      rewardId: `reward-${Date.now()}`,
      rewardName: activeSlots[selectedIndex]?.label || "Gội đầu miễn phí",
      rewardCode: makeRewardCode(),
      pointsAfter,
      selectedIndex,
    };

    saveMockReward({
      id: reward.rewardId,
      rewardName: reward.rewardName,
      rewardCode: reward.rewardCode,
      status: "unused",
      createdAt: new Date().toISOString(),
    });

    localStorage.setItem("haircut_mock_points", String(pointsAfter));
    return reward;
  }

  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase chưa được cấu hình");
  }

  const customerRef = doc(db, "customers", session.customer.customerId);
  const wheelRef = doc(db, "lucky_wheel", session.qr.salonId);
  const rewardRef = doc(collection(db, "reward_history"));

  return runTransaction(db, async (transaction) => {
    const [customerSnap, wheelSnap] = await Promise.all([
      transaction.get(customerRef),
      transaction.get(wheelRef),
    ]);

    if (!customerSnap.exists()) {
      throw new Error("Không tìm thấy khách hàng");
    }

    const customerData = customerSnap.data();
    const wheelConfig = wheelSnap.exists()
      ? normalizeLuckyWheelConfig(wheelSnap.data())
      : defaultLuckyWheelConfig;
    const activeSlots = activeWheelSlots(wheelConfig);
    const currentPoints = Number(customerData.points ?? 0);

    if (activeSlots.length === 0) {
      throw new Error("Vòng quay chưa có phần thưởng đang bật");
    }

    if (currentPoints < wheelConfig.requiredPoints) {
      throw new Error(`Khách chưa đủ ${wheelConfig.requiredPoints} điểm để quay`);
    }

    const selectedIndex = Math.floor(Math.random() * activeSlots.length);
    const rewardName = activeSlots[selectedIndex].label;
    const rewardCode = makeRewardCode();
    const pointsAfter = wheelConfig.deductPointsAfterSpin
      ? currentPoints - wheelConfig.requiredPoints
      : currentPoints;

    if (wheelConfig.deductPointsAfterSpin) {
      transaction.update(customerRef, {
        points: pointsAfter,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(rewardRef, {
      salonId: session.qr.salonId,
      customerId: session.customer.customerId,
      zaloUserId: session.zaloUserId,
      rewardName,
      rewardCode,
      selectedIndex,
      status: "unused",
      pointsUsed: wheelConfig.deductPointsAfterSpin ? wheelConfig.requiredPoints : 0,
      createdAt: serverTimestamp(),
    });

    return {
      rewardId: rewardRef.id,
      rewardName,
      rewardCode,
      pointsAfter,
      selectedIndex,
    };
  });
}

export async function getHaircutHistory(session: AppSession): Promise<HaircutRecord[]> {
  return callFunctionOrFallback<
    { salonId: string; zaloUserId: string; limit: number },
    CustomerHistoryFunctionResult | HaircutRecord[]
  >(
    "getCustomerHistoryFromZalo",
    {
      salonId: session.qr.salonId,
      zaloUserId: session.zaloUserId,
      limit: 20,
    },
    () => getHaircutHistoryDirect(session),
  ).then((result) => {
    if (Array.isArray(result)) {
      return result;
    }

    return result.records.map((record) => ({
      id: record.id,
      createdAt: formatDate(record.createdAtMs),
      staffName: record.staffName || "",
      note: record.note || "",
      photoUrls: Array.isArray(record.photoUrls) ? record.photoUrls : [],
      pointsAdded: Number(record.pointsAdded ?? 0),
    }));
  });
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
    where("customerId", "==", session.customer.customerId),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((item) => {
      const data = item.data();
      const createdAtMs = toMillis(data.createdAt);

      return {
        createdAtMs,
        record: {
          id: item.id,
          createdAt: formatDate(createdAtMs),
          staffName: data.staffName || "",
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

export async function getCustomerWheelConfig(salonId: string): Promise<LuckyWheelConfig> {
  if (!isFirebaseConfigured()) {
    return defaultLuckyWheelConfig;
  }

  const db = getFirebaseDb();

  if (!db) {
    return defaultLuckyWheelConfig;
  }

  const snap = await getDoc(doc(db, "lucky_wheel", salonId));

  return snap.exists() ? normalizeLuckyWheelConfig(snap.data()) : defaultLuckyWheelConfig;
}

export async function getRewards(session: AppSession): Promise<Reward[]> {
  return callFunctionOrFallback<
    { salonId: string; zaloUserId: string; limit: number },
    CustomerRewardsFunctionResult | Reward[]
  >(
    "getCustomerRewardsFromZalo",
    {
      salonId: session.qr.salonId,
      zaloUserId: session.zaloUserId,
      limit: 20,
    },
    () => getRewardsDirect(session),
  ).then((result) => {
    if (Array.isArray(result)) {
      return result;
    }

    return result.rewards.map((reward) => ({
      id: reward.id,
      rewardName: reward.rewardName || "",
      rewardCode: reward.rewardCode || "",
      status: normalizeRewardStatus(reward.status),
      createdAt: formatDate(reward.createdAtMs),
    }));
  });
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
    where("customerId", "==", session.customer.customerId),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((item) => {
      const data = item.data();
      const createdAtMs = toMillis(data.createdAt);

      return {
        createdAtMs,
        reward: {
          id: item.id,
          rewardName: data.rewardName || "",
          rewardCode: data.rewardCode || "",
          status: normalizeRewardStatus(data.status),
          createdAt: formatDate(createdAtMs),
        },
      };
    })
    .sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0))
    .slice(0, 20)
    .map((item) => item.reward);
}

export function parseQrContext(): QrContext {
  const params = new URLSearchParams(window.location.search);

  return {
    salonId: params.get("salonId") || "demo-salon",
    mirrorId: params.get("mirrorId") || "demo-mirror-1",
    qrToken: params.get("qrToken") || "demo-token",
  };
}

export function buildRegisterInput(
  qr: QrContext,
  identity: ZaloIdentity,
  allowPhoto: boolean,
  phone?: string,
): RegisterInput {
  return {
    ...qr,
    zaloUserId: identity.zaloUserId,
    name: identity.name,
    phone,
    allowPhoto,
  };
}

function mockRegisterCustomer(input: RegisterInput): AppSession {
  const existing = localStorage.getItem("haircut_mock_points");
  const points = existing ? Number(existing) : 4;

  return {
    qr: {
      salonId: input.salonId,
      mirrorId: input.mirrorId,
      qrToken: input.qrToken,
    },
    sessionId: "mock-session",
    zaloUserId: input.zaloUserId,
    sessionStatus: "waiting",
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
      salonId: input.salonId,
      mirrorId: input.mirrorId,
      qrToken: input.qrToken,
    },
    sessionId: result.sessionId,
    zaloUserId: input.zaloUserId,
    sessionStatus: "waiting",
    customer: {
      customerId: result.customerId,
      name: input.name || "Khách hàng",
      phoneLast4: phoneDigits ? phoneDigits.slice(-4) : input.phone?.slice(-4) || "",
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

function normalizeSessionStatus(value: unknown): AppSession["sessionStatus"] {
  if (value === "serving" || value === "completed" || value === "cancelled") {
    return value;
  }

  return "waiting";
}

function getMockRewards(): Reward[] {
  try {
    return JSON.parse(localStorage.getItem("haircut_mock_rewards") || "[]");
  } catch {
    return [];
  }
}

function saveMockReward(reward: Reward) {
  const rewards = getMockRewards();
  localStorage.setItem("haircut_mock_rewards", JSON.stringify([reward, ...rewards]));
}

function makeRewardCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0");
  return `HC-${date}-${random}`;
}

function normalizeRewardStatus(status: unknown): Reward["status"] {
  if (status === "used" || status === "expired") {
    return status;
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

function makeCustomerId(salonId: string, zaloUserId: string, phoneDigits: string) {
  const key = phoneDigits || zaloUserId || `guest-${Date.now()}`;

  return `${safeId(salonId)}_${safeId(key)}`;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
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
