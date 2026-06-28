import {
  DocumentData,
  QueryDocumentSnapshot,
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
  updateDoc,
  where,
} from "firebase/firestore";
import { callFunctionOrFallback, callWriteFunctionOrFallback } from "./functionWrites";
import { getFirebaseDb, isFirebaseConfigured } from "./firebase";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "./types";
import { normalizeLuckyWheelConfig } from "./wheel";

export type CustomerSummary = {
  id: string;
  name: string;
  phoneLast4: string;
  points: number;
  allowPhoto: boolean;
};

export type StaffSession = {
  id: string;
  salonId: string;
  mirrorId: string;
  customerId: string;
  zaloUserId: string;
  status: "waiting" | "serving" | "completed" | "cancelled";
  createdAtMs: number | null;
  customer?: CustomerSummary;
};

export type PointRequest = {
  id: string;
  salonId: string;
  sessionId: string;
  customerId: string;
  staffName: string;
  note: string;
  pointsAdded: number;
  status: "pending" | "approved" | "rejected";
  createdAtMs: number | null;
  customer?: CustomerSummary;
};

export type OwnerOverview = {
  customersToday: number;
  pendingRequests: number;
  pointsApprovedToday: number;
  spinsToday: number;
  unusedRewards: number;
};

export function listenActiveSessions(
  salonId: string,
  onChange: (sessions: StaffSession[]) => void,
  onError: (message: string) => void,
) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    onChange(mockSessions());
    return () => undefined;
  }

  const q = query(collection(db, "chair_sessions"), where("salonId", "==", salonId));

  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        const sessions = snapshot.docs
          .map(mapSession)
          .filter((session) => session.status === "waiting" || session.status === "serving")
          .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

        onChange(await attachCustomers(sessions));
      } catch (error) {
        onError(errorMessage(error));
      }
    },
    (error) => onError(error.message),
  );
}

export function listenPendingPointRequests(
  salonId: string,
  onChange: (requests: PointRequest[]) => void,
  onError: (message: string) => void,
) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    onChange([]);
    return () => undefined;
  }

  const q = query(collection(db, "point_requests"), where("salonId", "==", salonId));

  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        const requests = snapshot.docs
          .map(mapPointRequest)
          .filter((request) => request.status === "pending")
          .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

        onChange(await attachCustomersToRequests(requests));
      } catch (error) {
        onError(errorMessage(error));
      }
    },
    (error) => onError(error.message),
  );
}

export async function getOwnerOverview(salonId: string): Promise<OwnerOverview> {
  return callFunctionOrFallback<{ salonId: string }, OwnerOverview>(
    "getOwnerOverview",
    { salonId },
    () => getOwnerOverviewDirect(salonId),
  );
}

async function getOwnerOverviewDirect(salonId: string): Promise<OwnerOverview> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      customersToday: 0,
      pendingRequests: 0,
      pointsApprovedToday: 0,
      spinsToday: 0,
      unusedRewards: 0,
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();

  const [sessionsSnap, requestsSnap, rewardsSnap] = await Promise.all([
    getDocs(query(collection(db, "chair_sessions"), where("salonId", "==", salonId))),
    getDocs(query(collection(db, "point_requests"), where("salonId", "==", salonId))),
    getDocs(query(collection(db, "reward_history"), where("salonId", "==", salonId))),
  ]);

  const customersToday = sessionsSnap.docs.filter((item) => {
    const createdAt = toMillis(item.data().createdAt);
    return Number(createdAt ?? 0) >= startMs;
  }).length;

  const requests = requestsSnap.docs.map((item) => item.data());
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const pointsApprovedToday = requests
    .filter((request) => {
      const approvedAt = toMillis(request.approvedAt) ?? toMillis(request.createdAt);
      return request.status === "approved" && Number(approvedAt ?? 0) >= startMs;
    })
    .reduce((total, request) => total + Number(request.pointsAdded ?? request.pointsRequested ?? 1), 0);

  const rewards = rewardsSnap.docs.map((item) => item.data());
  const spinsToday = rewards.filter((reward) => {
    const createdAt = toMillis(reward.createdAt);
    return Number(createdAt ?? 0) >= startMs;
  }).length;
  const unusedRewards = rewards.filter((reward) => reward.status === "unused").length;

  return {
    customersToday,
    pendingRequests,
    pointsApprovedToday,
    spinsToday,
    unusedRewards,
  };
}

export async function submitPointRequest(input: {
  salonId: string;
  session: StaffSession;
  staffName: string;
  note: string;
}) {
  return callWriteFunctionOrFallback(
    "submitPointRequest",
    {
      salonId: input.salonId,
      sessionId: input.session.id,
      staffName: input.staffName,
      note: input.note,
      photoUrls: [],
      pointsRequested: 1,
    },
    () => submitPointRequestDirect(input),
  );
}

async function submitPointRequestDirect(input: {
  salonId: string;
  session: StaffSession;
  staffName: string;
  note: string;
}) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  await addDoc(collection(db, "point_requests"), {
    salonId: input.salonId,
    customerId: input.session.customerId,
    sessionId: input.session.id,
    staffName: input.staffName,
    note: input.note,
    pointsAdded: 1,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "chair_sessions", input.session.id), {
    status: "serving",
    updatedAt: serverTimestamp(),
  });
}

export async function approvePointRequest(request: PointRequest) {
  return callWriteFunctionOrFallback(
    "approvePointRequest",
    {
      salonId: request.salonId,
      requestId: request.id,
    },
    () => approvePointRequestDirect(request),
  );
}

async function approvePointRequestDirect(request: PointRequest) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  const requestRef = doc(db, "point_requests", request.id);
  const customerRef = doc(db, "customers", request.customerId);
  const sessionRef = doc(db, "chair_sessions", request.sessionId);
  const recordRef = doc(collection(db, "haircut_records"));

  await runTransaction(db, async (transaction) => {
    const [requestSnap, customerSnap] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(customerRef),
    ]);

    if (!requestSnap.exists()) {
      throw new Error("Không tìm thấy yêu cầu cộng điểm");
    }
    if (!customerSnap.exists()) {
      throw new Error("Không tìm thấy hồ sơ khách");
    }

    const requestData = requestSnap.data();

    if (requestData.status !== "pending") {
      throw new Error("Yêu cầu này đã được xử lý");
    }

    const currentPoints = Number(customerSnap.data().points ?? 0);
    const pointsAdded = Number(requestData.pointsAdded ?? 1);

    transaction.update(customerRef, {
      points: currentPoints + pointsAdded,
      updatedAt: serverTimestamp(),
    });

    transaction.set(recordRef, {
      salonId: requestData.salonId,
      customerId: requestData.customerId,
      staffName: requestData.staffName || "",
      note: requestData.note || "",
      photoUrls: [],
      pointsAdded,
      createdAt: serverTimestamp(),
    });

    transaction.update(requestRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
    });

    transaction.update(sessionRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function rejectPointRequest(request: PointRequest) {
  return callWriteFunctionOrFallback(
    "rejectPointRequest",
    {
      salonId: request.salonId,
      requestId: request.id,
      reason: "Chủ salon từ chối",
    },
    () => rejectPointRequestDirect(request),
  );
}

async function rejectPointRequestDirect(request: PointRequest) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  await updateDoc(doc(db, "point_requests", request.id), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });
}

export async function getLuckyWheelConfig(salonId: string): Promise<LuckyWheelConfig> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return defaultLuckyWheelConfig;
  }

  const snap = await getDoc(doc(db, "lucky_wheel", salonId));

  if (!snap.exists()) {
    return defaultLuckyWheelConfig;
  }

  return normalizeLuckyWheelConfig(snap.data());
}

export async function saveLuckyWheelConfig(salonId: string, config: LuckyWheelConfig) {
  const normalized = normalizeLuckyWheelConfig(config);

  return callWriteFunctionOrFallback(
    "updateLuckyWheel",
    {
      salonId,
      requiredPoints: normalized.requiredPoints,
      deductPointsAfterSpin: normalized.deductPointsAfterSpin,
      slots: normalized.slots,
    },
    () => saveLuckyWheelConfigDirect(salonId, normalized),
  );
}

async function saveLuckyWheelConfigDirect(salonId: string, config: LuckyWheelConfig) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  await setDoc(
    doc(db, "lucky_wheel", salonId),
    {
      salonId,
      requiredPoints: config.requiredPoints,
      deductPointsAfterSpin: config.deductPointsAfterSpin,
      slots: config.slots,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function formatDateTime(ms: number | null) {
  if (!ms) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(ms));
}

function mapSession(docSnap: QueryDocumentSnapshot<DocumentData>): StaffSession {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    salonId: String(data.salonId || ""),
    mirrorId: String(data.mirrorId || ""),
    customerId: String(data.customerId || ""),
    zaloUserId: String(data.zaloUserId || ""),
    status: normalizeSessionStatus(data.status),
    createdAtMs: toMillis(data.createdAt),
  };
}

function mapPointRequest(docSnap: QueryDocumentSnapshot<DocumentData>): PointRequest {
  const data = docSnap.data();

  return {
    id: docSnap.id,
    salonId: String(data.salonId || ""),
    sessionId: String(data.sessionId || ""),
    customerId: String(data.customerId || ""),
    staffName: String(data.staffName || ""),
    note: String(data.note || ""),
    pointsAdded: Number(data.pointsAdded ?? data.pointsRequested ?? 1),
    status: normalizeRequestStatus(data.status),
    createdAtMs: toMillis(data.createdAt),
  };
}

async function attachCustomers(sessions: StaffSession[]) {
  const pairs = await Promise.all(
    sessions.map(async (session) => ({
      ...session,
      customer: await getCustomer(session.customerId),
    })),
  );

  return pairs;
}

async function attachCustomersToRequests(requests: PointRequest[]) {
  const pairs = await Promise.all(
    requests.map(async (request) => ({
      ...request,
      customer: await getCustomer(request.customerId),
    })),
  );

  return pairs;
}

async function getCustomer(customerId: string): Promise<CustomerSummary | undefined> {
  const db = getFirebaseDb();

  if (!db || !customerId) {
    return undefined;
  }

  const snap = await getDoc(doc(db, "customers", customerId));

  if (!snap.exists()) {
    return undefined;
  }

  const data = snap.data();

  return {
    id: snap.id,
    name: String(data.name || "Khách hàng"),
    phoneLast4: String(data.phoneLast4 || ""),
    points: Number(data.points ?? 0),
    allowPhoto: Boolean(data.allowPhoto),
  };
}

function normalizeSessionStatus(value: unknown): StaffSession["status"] {
  if (value === "serving" || value === "completed" || value === "cancelled") {
    return value;
  }

  return "waiting";
}

function normalizeRequestStatus(value: unknown): PointRequest["status"] {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function toMillis(value: unknown): number | null {
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

  if (typeof value === "object" && "toMillis" in value) {
    const maybeTimestamp = value as { toMillis?: () => number };
    return typeof maybeTimestamp.toMillis === "function" ? maybeTimestamp.toMillis() : null;
  }

  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra";
}

function mockSessions(): StaffSession[] {
  return [
    {
      id: "mock-session",
      salonId: "demo-salon",
      mirrorId: "demo-mirror-1",
      customerId: "mock-customer",
      zaloUserId: "mock-zalo-user",
      status: "waiting",
      createdAtMs: Date.now(),
      customer: {
        id: "mock-customer",
        name: "Nguyễn Văn A",
        phoneLast4: "8761",
        points: 4,
        allowPhoto: true,
      },
    },
  ];
}
