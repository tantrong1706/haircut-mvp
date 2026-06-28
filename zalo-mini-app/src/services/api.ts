import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "./firebase";
import {
  AppSession,
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

export async function registerCustomer(input: RegisterInput): Promise<AppSession> {
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
  if (!isFirebaseConfigured()) {
    const pointsAfter = Math.max(
      0,
      session.customer.points - defaultLuckyWheelConfig.requiredPoints,
    );
    const reward = {
      rewardId: `reward-${Date.now()}`,
      rewardName: "Gội đầu miễn phí",
      rewardCode: `HC-${Math.floor(1000 + Math.random() * 9000)}`,
      pointsAfter,
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

    const rewardName = activeSlots[Math.floor(Math.random() * activeSlots.length)].label;
    const rewardCode = `HC-${Math.floor(1000 + Math.random() * 9000)}`;
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
      status: "unused",
      pointsUsed: wheelConfig.deductPointsAfterSpin ? wheelConfig.requiredPoints : 0,
      createdAt: serverTimestamp(),
    });

    return {
      rewardId: rewardRef.id,
      rewardName,
      rewardCode,
      pointsAfter,
    };
  });
}

export async function getHaircutHistory(session: AppSession): Promise<HaircutRecord[]> {
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

      return {
        id: item.id,
        createdAt: formatDate(toMillis(data.createdAt)),
        staffName: data.staffName || "",
        note: data.note || "",
        photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
        pointsAdded: Number(data.pointsAdded ?? 0),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
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

      return {
        id: item.id,
        rewardName: data.rewardName || "",
        rewardCode: data.rewardCode || "",
        status: data.status || "unused",
        createdAt: formatDate(toMillis(data.createdAt)),
      };
    })
    .slice(0, 20);
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
    customer: {
      customerId: "mock-customer",
      name: input.name,
      phoneLast4: input.phone?.slice(-4) || "1234",
      points,
      allowPhoto: input.allowPhoto,
    },
  };
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
