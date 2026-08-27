import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { getDownloadURL, ref } from "firebase/storage";
import {
  DEFAULT_SYSTEM_FEATURES,
  normalizeSystemFeatures,
  type SystemFeatures,
} from "@haircut/contracts";
import { callFunctionOrFallback, callWriteFunctionOrFallback } from "./functionWrites";
import {
  callFunction,
  getFirebaseAuth,
  getFirebaseDb,
  getFirebaseStorage,
  isFirebaseConfigured,
} from "./firebase";
import { LuckyWheelConfig, defaultLuckyWheelConfig } from "./types";
import { normalizeLuckyWheelConfig } from "./wheel";
import { safeStorageGet, safeStorageRemove, safeStorageSet } from "./safeStorage";

const SESSION_POINT_REQUEST_WINDOW_MS = 12 * 60 * 60 * 1000;

export type CustomerSummary = {
  id: string;
  name: string;
  phone?: string;
  phoneLast4: string;
  points: number;
  allowPhoto: boolean;
};

export type StaffSession = {
  id: string;
  salonId: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
  mirrorId: string;
  mirrorName: string;
  customerId: string;
  status: "waiting" | "serving" | "pending_approval" | "completed" | "cancelled";
  assignedStaffId: string;
  assignedStaffName: string;
  claimedAtMs: number | null;
  createdAtMs: number | null;
  expiresAtMs: number | null;
  cancellationReason: string;
  customer?: CustomerSummary;
};

export type ManagerSessionHistoryItem = Omit<
  StaffSession,
  "mirrorId" | "mirrorName" | "expiresAtMs"
> & {
  status: "completed" | "cancelled";
  completedAtMs: number | null;
  cancelledAtMs: number | null;
};

export type PointRequest = {
  id: string;
  salonId: string;
  branchId: string;
  branchName: string;
  sessionId: string;
  customerId: string;
  staffName: string;
  note: string;
  photoUrls: string[];
  legacyPhotoUrls?: string[];
  photoPaths?: string[];
  pointsAdded: number;
  status: "pending" | "approved" | "rejected";
  createdAtMs: number | null;
  customer?: CustomerSummary;
};

export type ManagerPointRequestHistoryItem = Omit<PointRequest, "photoUrls"> & {
  status: "approved" | "rejected";
  rejectionReason: string;
  processedAtMs: number | null;
};

export type ManagerRewardHistoryItem = {
  id: string;
  rewardName: string;
  rewardCode?: string;
  rewardCodeLast4: string;
  status: "unused" | "used" | "expired" | "revoked";
  branchId: string;
  customerId: string;
  customerName: string;
  usedBy?: string;
  createdAtMs: number | null;
  usedAtMs: number | null;
  expiresAtMs: number | null;
};

export type ManagerAuditEventItem = {
  id: string;
  branchId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  createdAtMs: number | null;
};

export type OwnerOverview = {
  customersToday: number;
  customers7Days: number;
  customers30Days: number;
  pendingRequests: number;
  pointsApprovedToday: number;
  spinsToday: number;
  unusedRewards: number;
  inactiveCustomers: InactiveCustomer[];
};

export type InactiveCustomer = {
  id: string;
  name: string;
  phone?: string;
  phoneLast4: string;
  points: number;
  lastVisitAtMs: number | null;
  daysSinceLastVisit: number;
};

export type SalonProfile = {
  id: string;
  name: string;
  address: string;
  phone: string;
  avatarUrl: string;
  pointPerVisit: number;
  freeCustomerLimit: number;
  features: SystemFeatures;
};

export type RedeemRewardResult = {
  rewardId: string;
  rewardCode: string;
  rewardName: string;
  customerName?: string;
  alreadyRedeemed?: boolean;
};

export type SubmitPointRequestResult = {
  requestId: string;
  alreadySubmitted: boolean;
  status: "approved" | "pending_approval";
  approvalMode?: "staff_direct" | "owner_direct" | "owner_approval";
  pointsAdded: number;
  pointsAfter?: number;
};

export type SalonMirror = {
  id: string;
  salonId: string;
  name: string;
  qrToken: string;
  qrUrl: string;
  isActive: boolean;
  createdAtMs: number | null;
};

export type SalonBranch = {
  id: string;
  salonId: string;
  name: string;
  address: string;
  phone: string;
  qrUrl: string;
  isActive: boolean;
};

export type BranchQrSettings = {
  salonQrUrl: string;
  branches: SalonBranch[];
};

export type StaffProfile = {
  uid: string;
  salonId: string;
  name: string;
  email: string;
  phone: string;
  role: "staff";
  isActive: boolean;
  canRedeemRewards: boolean;
  canAwardPointsDirectly: boolean;
  branchId: string;
  branchIds: string[];
  inviteStatus: "pending" | "accepted";
};

export type CustomerRecordSummary = {
  id: string;
  branchId: string;
  branchName: string;
  staffName: string;
  note: string;
  photoUrls: string[];
  pointsAdded: number;
  createdAtMs: number | null;
};

export type CustomerRewardSummary = {
  id: string;
  rewardName: string;
  rewardCode: string;
  status: "unused" | "used" | "expired" | "revoked";
  branchId: string;
  createdAtMs: number | null;
  usedAtMs: number | null;
  expiresAtMs: number | null;
};

export type CustomerBranchVisit = {
  branchId: string;
  branchName: string;
  lastVisitAtMs: number | null;
};

export type CustomerLookupResult = CustomerSummary & {
  detailsLoaded: boolean;
  lastVisitAtMs: number | null;
  recentRecords: CustomerRecordSummary[];
  rewardHistory: CustomerRewardSummary[];
  unusedRewards: CustomerRewardSummary[];
  branchVisits: CustomerBranchVisit[];
};

export type CustomerSearchPage = {
  customers: CustomerLookupResult[];
  nextCursor: string | null;
};

export type RewardCodeInfo = {
  found: boolean;
  rewardId?: string;
  rewardCode: string;
  rewardName?: string;
  status: "unused" | "used" | "expired" | "revoked" | "not_found";
  customerName?: string;
  createdAtMs?: number | null;
  usedAtMs?: number | null;
  expiresAtMs?: number | null;
};

export type DeleteCustomerDataResult = {
  customerId: string;
  status: "completed";
  deletedRecords: number;
  deletedRewards: number;
  deletedRequests: number;
  deletedSessions: number;
  deletedStorageFiles: number;
};

export function listenActiveSessions(
  salonId: string,
  branchIds: string[] | null,
  onChange: (sessions: StaffSession[]) => void,
  onError: (message: string) => void,
) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    onChange(
      branchIds === null
        ? mockSessions()
        : mockSessions().filter((session) => branchIds.includes(session.branchId)),
    );
    return () => undefined;
  }

  const targets = branchIds === null ? [null] : [...new Set(branchIds.filter(Boolean))];
  if (targets.length === 0) {
    onChange([]);
    return () => undefined;
  }

  const sessionsByTarget = new Map<string, StaffSession[]>();
  const emit = () => {
    try {
      const nowMs = Date.now();
      const sessions = [...sessionsByTarget.values()]
        .flat()
        .filter(
          (session) =>
            (session.status === "waiting" ||
              session.status === "serving" ||
              session.status === "pending_approval") &&
            (session.expiresAtMs === null || session.expiresAtMs > nowMs),
        )
        .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
      onChange(sessions);
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  const unsubscribers = targets.map((branchId) => {
    const constraints = [
      where("salonId", "==", salonId),
      ...(branchId ? [where("branchId", "==", branchId)] : []),
      where("status", "in", ["waiting", "serving", "pending_approval"]),
      orderBy("createdAt", "desc"),
      firestoreLimit(100),
    ];
    const q = query(collection(db, "chair_sessions"), ...constraints);
    const key = branchId || "all";

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          sessionsByTarget.set(key, snapshot.docs.map(mapSession));
          emit();
        } catch (error) {
          onError(errorMessage(error));
        }
      },
      (error) => onError(error.message),
    );
  });

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function listenPendingPointRequests(
  salonId: string,
  branchId: string | null,
  onChange: (requests: PointRequest[]) => void,
  onError: (message: string) => void,
) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    onChange([]);
    return () => undefined;
  }

  const constraints = [
    where("salonId", "==", salonId),
    ...(branchId ? [where("branchId", "==", branchId)] : []),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    firestoreLimit(100),
  ];
  const q = query(collection(db, "point_requests"), ...constraints);

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

export async function getOwnerOverview(
  salonId: string,
  branchId: string | null = null,
): Promise<OwnerOverview> {
  return callFunctionOrFallback<{ salonId: string; branchId?: string }, OwnerOverview>(
    "getOwnerOverview",
    { salonId, ...(branchId ? { branchId } : {}) },
    () => getOwnerOverviewDirect(salonId, branchId),
  );
}

export async function getManagerSessionHistory(input: {
  salonId: string;
  branchId?: string | null;
  limit?: number;
}): Promise<{ sessions: ManagerSessionHistoryItem[] }> {
  return callFunction<
    { salonId: string; branchId?: string; limit: number },
    { sessions: ManagerSessionHistoryItem[] }
  >("getManagerSessionHistory", {
    salonId: input.salonId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    limit: input.limit ?? 30,
  });
}

export async function getManagerPointRequestHistory(input: {
  salonId: string;
  branchId?: string | null;
  limit?: number;
}): Promise<{ requests: ManagerPointRequestHistoryItem[] }> {
  return callFunction<
    { salonId: string; branchId?: string; limit: number },
    { requests: ManagerPointRequestHistoryItem[] }
  >("getManagerPointRequestHistory", {
    salonId: input.salonId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    limit: input.limit ?? 30,
  });
}

export async function getManagerRewardHistory(input: {
  salonId: string;
  branchId?: string | null;
  limit?: number;
}): Promise<{ rewards: ManagerRewardHistoryItem[] }> {
  return callFunction<
    { salonId: string; branchId?: string; limit: number },
    { rewards: ManagerRewardHistoryItem[] }
  >("getManagerRewardHistory", {
    salonId: input.salonId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    limit: input.limit ?? 30,
  });
}

export async function getManagerAuditEvents(input: {
  salonId: string;
  branchId?: string | null;
  limit?: number;
}): Promise<{ events: ManagerAuditEventItem[] }> {
  return callFunction<
    { salonId: string; branchId?: string; limit: number },
    { events: ManagerAuditEventItem[] }
  >("getManagerAuditEvents", {
    salonId: input.salonId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    limit: input.limit ?? 30,
  });
}

export async function getSalonProfile(salonId: string): Promise<SalonProfile> {
  return callFunctionOrFallback<{ salonId: string }, SalonProfile>(
    "getSalonProfile",
    { salonId },
    () => getSalonProfileDirect(salonId),
  );
}

export async function updateSalonProfile(input: {
  salonId: string;
  name: string;
  address?: string;
  phone?: string;
  pointPerVisit: number;
}): Promise<SalonProfile> {
  const name = input.name.trim();
  const address = input.address?.trim() || "";
  const phone = input.phone?.trim() || "";
  const pointPerVisit = Math.max(1, Math.floor(Number(input.pointPerVisit || 1)));

  if (!name) {
    throw new Error("Vui lòng nhập tên salon");
  }

  return callWriteFunctionOrFallback(
    "updateSalonProfile",
    {
      salonId: input.salonId,
      name,
      address,
      phone,
      pointPerVisit,
    },
    () =>
      updateSalonProfileDirect({
        salonId: input.salonId,
        name,
        address,
        phone,
        pointPerVisit,
      }),
  );
}

async function getOwnerOverviewDirect(
  salonId: string,
  branchId: string | null,
): Promise<OwnerOverview> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      customersToday: 0,
      customers7Days: 0,
      customers30Days: 0,
      pendingRequests: 0,
      pointsApprovedToday: 0,
      spinsToday: 0,
      unusedRewards: 0,
      inactiveCustomers: [],
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  const nowMs = Date.now();
  const start7Ms = nowMs - 7 * 24 * 60 * 60 * 1000;
  const start30Ms = nowMs - 30 * 24 * 60 * 60 * 1000;
  const inactiveCutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  const [recordsSnap, requestsSnap, rewardsSnap, customersSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "haircut_records"),
        where("salonId", "==", salonId),
        ...(branchId ? [where("branchId", "==", branchId)] : []),
      ),
    ),
    getDocs(
      query(
        collection(db, "point_requests"),
        where("salonId", "==", salonId),
        ...(branchId ? [where("branchId", "==", branchId)] : []),
      ),
    ),
    getDocs(
      query(
        collection(db, "reward_history"),
        where("salonId", "==", salonId),
        ...(branchId ? [where("branchId", "==", branchId)] : []),
      ),
    ),
    getDocs(
      query(
        collection(db, "customers"),
        where("salonId", "==", salonId),
        ...(branchId ? [where("lastBranchId", "==", branchId)] : []),
      ),
    ),
  ]);

  const completedRecords = recordsSnap.docs.map((item) => ({
    customerId: String(item.data().customerId || ""),
    createdAtMs: toMillis(item.data().createdAt),
  }));
  const countUnique = (sinceMs: number) =>
    new Set(
      completedRecords
        .filter((record) => (record.createdAtMs ?? 0) >= sinceMs)
        .map((record) => record.customerId)
        .filter(Boolean),
    ).size;
  const inactiveCustomers = customersSnap.docs
    .map((item): InactiveCustomer => {
      const data = item.data();
      const lastVisitAtMs = toMillis(data.lastVisitAt);
      const daysSinceLastVisit = lastVisitAtMs
        ? Math.max(0, Math.floor((nowMs - lastVisitAtMs) / (24 * 60 * 60 * 1000)))
        : 999;

      return {
        id: item.id,
        name: String(data.name || "Khách hàng"),
        phone: String(data.phone || ""),
        phoneLast4: String(data.phoneLast4 || ""),
        points: Number(data.points ?? 0),
        lastVisitAtMs,
        daysSinceLastVisit,
      };
    })
    .filter((customer) => !customer.lastVisitAtMs || customer.lastVisitAtMs < inactiveCutoffMs)
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit)
    .slice(0, 5);

  const requests = requestsSnap.docs.map((item) => item.data());
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const pointsApprovedToday = requests
    .filter((request) => {
      const approvedAt = toMillis(request.approvedAt) ?? toMillis(request.createdAt);
      return request.status === "approved" && Number(approvedAt ?? 0) >= startMs;
    })
    .reduce(
      (total, request) => total + Number(request.pointsAdded ?? request.pointsRequested ?? 1),
      0,
    );

  const rewards = rewardsSnap.docs.map((item) => item.data());
  const spinsToday = rewards.filter((reward) => {
    const createdAt = toMillis(reward.createdAt);
    return Number(createdAt ?? 0) >= startMs;
  }).length;
  const unusedRewards = rewards.filter((reward) => reward.status === "unused").length;

  return {
    customersToday: countUnique(startMs),
    customers7Days: countUnique(start7Ms),
    customers30Days: countUnique(start30Ms),
    pendingRequests,
    pointsApprovedToday,
    spinsToday,
    unusedRewards,
    inactiveCustomers,
  };
}

async function getSalonProfileDirect(salonId: string): Promise<SalonProfile> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      id: salonId,
      name: "HAIRCUT Studio",
      address: "",
      phone: "",
      avatarUrl: "",
      pointPerVisit: 1,
      freeCustomerLimit: 50,
      features: { ...DEFAULT_SYSTEM_FEATURES },
    };
  }

  const snap = await getDoc(doc(db, "salons", salonId));

  if (!snap.exists()) {
    return {
      id: salonId,
      name: "Salon",
      address: "",
      phone: "",
      avatarUrl: "",
      pointPerVisit: 1,
      freeCustomerLimit: 50,
      features: { ...DEFAULT_SYSTEM_FEATURES },
    };
  }

  const data = snap.data();
  return {
    id: snap.id,
    name: String(data.name || "Salon"),
    address: String(data.address || ""),
    phone: String(data.phone || ""),
    avatarUrl: String(data.avatarUrl || ""),
    pointPerVisit: Number(data.pointPerVisit ?? 1),
    freeCustomerLimit: Number(data.freeCustomerLimit ?? 50),
    features: normalizeSystemFeatures(data.features),
  };
}

async function updateSalonProfileDirect(input: {
  salonId: string;
  name: string;
  address: string;
  phone: string;
  pointPerVisit: number;
}): Promise<SalonProfile> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      id: input.salonId,
      name: input.name,
      address: input.address,
      phone: input.phone,
      avatarUrl: "",
      pointPerVisit: input.pointPerVisit,
      freeCustomerLimit: 50,
      features: { ...DEFAULT_SYSTEM_FEATURES },
    };
  }

  const salonRef = doc(db, "salons", input.salonId);
  await setDoc(
    salonRef,
    {
      name: input.name,
      address: input.address || null,
      phone: input.phone || null,
      pointPerVisit: input.pointPerVisit,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return getSalonProfileDirect(input.salonId);
}

export async function getMirrors(salonId: string): Promise<SalonMirror[]> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return mockMirrors(salonId);
  }

  const snap = await getDocs(query(collection(db, "mirrors"), where("salonId", "==", salonId)));
  return snap.docs.map(mapMirror).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function createMirror(input: { salonId: string; name: string }): Promise<SalonMirror> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Vui lòng nhập tên gương/ghế");
  }

  return callWriteFunctionOrFallback("createMirror", { salonId: input.salonId, name }, () =>
    createMirrorDirect(input.salonId, name),
  ).then((result) => normalizeMirrorResult(input.salonId, result));
}

export async function updateMirror(input: {
  salonId: string;
  mirrorId: string;
  name?: string;
  isActive?: boolean;
  regenerateQr?: boolean;
}): Promise<SalonMirror> {
  return callWriteFunctionOrFallback("updateMirror", input, () => updateMirrorDirect(input)).then(
    (result) => normalizeMirrorResult(input.salonId, result, input.mirrorId),
  );
}

export async function getBranchQrSettings(salonId: string): Promise<BranchQrSettings> {
  if (!isFirebaseConfigured()) {
    return mockBranchQrSettings(salonId);
  }
  const result = await callFunction<
    { salonId: string },
    { salonQrUrl: string; branches: unknown[] }
  >("listBranches", { salonId });
  return {
    salonQrUrl: String(result.salonQrUrl || ""),
    branches: result.branches.map((branch) => normalizeBranch(salonId, branch)),
  };
}

export async function createBranch(input: {
  salonId: string;
  name: string;
  address?: string;
  phone?: string;
}): Promise<SalonBranch> {
  if (!isFirebaseConfigured()) {
    return mockBranchQrSettings(input.salonId).branches[0];
  }
  const result = await callFunction<typeof input, unknown>("createBranch", input);
  return normalizeBranch(input.salonId, result);
}

export async function updateBranch(input: {
  salonId: string;
  branchId: string;
  name?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}): Promise<SalonBranch> {
  if (!isFirebaseConfigured()) {
    return {
      ...mockBranchQrSettings(input.salonId).branches[0],
      name: input.name || "Chi nhánh chính",
      address: input.address || "",
      phone: input.phone || "",
      isActive: input.isActive ?? true,
    };
  }
  const result = await callFunction<typeof input, unknown>("updateBranch", input);
  return normalizeBranch(input.salonId, result, input.branchId);
}

export async function rotateSalonQr(salonId: string): Promise<string> {
  if (!isFirebaseConfigured()) {
    return mockBranchQrSettings(salonId).salonQrUrl;
  }
  const result = await callFunction<{ salonId: string }, { qrUrl: string }>("rotateSalonQr", {
    salonId,
  });
  return String(result.qrUrl || "");
}

export async function rotateBranchQr(salonId: string, branchId: string): Promise<string> {
  if (!isFirebaseConfigured()) {
    return mockBranchQrSettings(salonId).branches[0].qrUrl;
  }
  const result = await callFunction<{ salonId: string; branchId: string }, { qrUrl: string }>(
    "rotateBranchQr",
    { salonId, branchId },
  );
  return String(result.qrUrl || "");
}

export async function migrateSalonBranches(salonId: string) {
  if (!isFirebaseConfigured()) {
    return { branchId: "demo-branch-main", branchName: "Chi nhánh chính", counts: {} };
  }
  return callFunction<
    { salonId: string },
    { branchId: string; branchName: string; counts: Record<string, number> }
  >("migrateSalonBranches", { salonId });
}

export async function getStaffProfiles(salonId: string): Promise<StaffProfile[]> {
  return callFunctionOrFallback<{ salonId: string }, { staff: StaffProfile[] }>(
    "listStaffProfiles",
    { salonId },
    () => getStaffProfilesDirect(salonId),
  ).then((result) => result.staff.sort((a, b) => a.name.localeCompare(b.name, "vi")));
}

export function listenStaffProfiles(
  salonId: string,
  onChange: (staff: StaffProfile[]) => void,
  onError: (message: string) => void,
) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    void getStaffProfilesDirect(salonId).then((result) => onChange(result.staff));
    return () => undefined;
  }

  const staffQuery = query(
    collection(db, "users"),
    where("salonId", "==", salonId),
    where("role", "==", "staff"),
  );

  return onSnapshot(
    staffQuery,
    (snapshot) => {
      onChange(
        snapshot.docs
          .map(mapStaffProfile)
          .filter((staff): staff is StaffProfile => Boolean(staff))
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
    },
    (error) => onError(error.message),
  );
}

export async function createStaffProfile(input: {
  salonId: string;
  email: string;
  name: string;
  phone?: string;
  canRedeemRewards: boolean;
  canAwardPointsDirectly: boolean;
  branchIds: string[];
}): Promise<{ uid: string; email: string; inviteEmailSent: boolean }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email || !name) {
    throw new Error("Vui lòng nhập email và tên nhân viên");
  }

  if (!isFirebaseConfigured()) {
    return {
      uid: `demo-staff-${Date.now()}`,
      email,
      inviteEmailSent: false,
    };
  }

  const result = await callFunction<
    {
      salonId: string;
      email: string;
      name: string;
      phone?: string;
      canRedeemRewards: boolean;
      canAwardPointsDirectly: boolean;
      branchIds: string[];
    },
    { uid: string; email: string }
  >("createStaffProfile", {
    salonId: input.salonId,
    email,
    name,
    phone: input.phone?.trim() || undefined,
    canRedeemRewards: input.canRedeemRewards,
    canAwardPointsDirectly: input.canAwardPointsDirectly,
    branchIds: input.branchIds,
  });

  return {
    ...result,
    inviteEmailSent: await sendStaffInviteEmail(result.email),
  };
}

export async function sendStaffInviteEmail(email: string): Promise<boolean> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return false;
  }

  try {
    auth.languageCode = "vi";
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/staff`,
      handleCodeInApp: false,
    });
    return true;
  } catch (error) {
    console.warn("Không gửi được email mời nhân viên.", error);
    return false;
  }
}

export async function updateStaffProfile(input: {
  salonId: string;
  uid: string;
  name?: string;
  phone?: string;
  isActive?: boolean;
  canRedeemRewards?: boolean;
  canAwardPointsDirectly?: boolean;
  branchIds?: string[];
}) {
  return callWriteFunctionOrFallback("updateStaffProfile", input, () =>
    updateStaffProfileDirect(input),
  );
}

export async function searchSalonCustomers(input: {
  salonId: string;
  branchId?: string;
  term: string;
  cursor?: string | null;
  pageSize?: number;
}): Promise<CustomerSearchPage> {
  const term = input.term.trim();

  if (term.length < 2) {
    return { customers: [], nextCursor: null };
  }
  const phoneDigits = term.replace(/\D/g, "");
  if (phoneDigits.length === term.replace(/\s/g, "").length && phoneDigits.length !== 4) {
    throw new Error("Vui lòng nhập đủ 4 số cuối điện thoại");
  }

  return callFunction<
    { salonId: string; branchId?: string; term: string; cursor?: string; pageSize: number },
    CustomerSearchPage
  >("searchSalonCustomers", {
    salonId: input.salonId,
    branchId: input.branchId,
    term,
    cursor: input.cursor || undefined,
    pageSize: input.pageSize || 10,
  });
}

export async function getSalonCustomerDetails(input: {
  salonId: string;
  customerId: string;
  branchId?: string;
}): Promise<CustomerLookupResult> {
  const result = await callFunction<
    { salonId: string; customerId: string; branchId?: string },
    { customer: CustomerLookupResult }
  >("getSalonCustomerDetails", {
    salonId: input.salonId,
    branchId: input.branchId,
    customerId: input.customerId,
  });
  return result.customer;
}

export async function deleteCustomerData(input: {
  salonId: string;
  customerId: string;
}): Promise<DeleteCustomerDataResult> {
  const customerId = input.customerId.trim();

  if (!customerId) {
    throw new Error("Thiếu hồ sơ khách cần xóa");
  }

  if (!isFirebaseConfigured()) {
    return deleteCustomerDataDirect(input.salonId, customerId);
  }

  return callFunction<{ salonId: string; customerId: string }, DeleteCustomerDataResult>(
    "deleteCustomerData",
    { salonId: input.salonId, customerId },
  );
}

export async function lookupRewardCode(input: {
  salonId: string;
  branchId?: string;
  rewardCode: string;
}): Promise<RewardCodeInfo> {
  const rewardCode = normalizeRewardCode(input.rewardCode);

  if (!rewardCode) {
    throw new Error("Vui lòng nhập mã quà");
  }

  return callFunctionOrFallback<
    { salonId: string; branchId?: string; rewardCode: string },
    RewardCodeInfo
  >("lookupRewardCode", { salonId: input.salonId, branchId: input.branchId, rewardCode }, () =>
    lookupRewardCodeDirect(input.salonId, input.branchId, rewardCode),
  );
}

export async function submitPointRequest(input: {
  salonId: string;
  session: StaffSession;
  note: string;
  photoUrls?: string[];
  photoPaths?: string[];
  pointsRequested?: number;
}): Promise<SubmitPointRequestResult> {
  const pointsRequested =
    input.pointsRequested && input.pointsRequested > 0
      ? Math.floor(input.pointsRequested)
      : await getSalonPointPerVisit(input.salonId);

  return callWriteFunctionOrFallback<
    {
      salonId: string;
      sessionId: string;
      note: string;
      photoUrls: string[];
      photoPaths: string[];
      pointsRequested: number;
    },
    SubmitPointRequestResult
  >(
    "submitPointRequest",
    {
      salonId: input.salonId,
      sessionId: input.session.id,
      note: input.note,
      photoUrls: input.photoUrls ?? [],
      photoPaths: input.photoPaths ?? [],
      pointsRequested,
    },
    () => submitPointRequestDirect({ ...input, pointsRequested }),
  );
}

export async function updatePendingPointRequestPhotos(input: {
  salonId: string;
  requestId: string;
  photoUrls: string[];
  photoPaths?: string[];
}): Promise<{ photoUrls: string[]; photoPaths: string[] }> {
  return callFunction("updatePendingPointRequestPhotos", input);
}

export async function claimServiceSession(input: {
  salonId: string;
  session: StaffSession;
}): Promise<{
  status: StaffSession["status"];
  assignedStaffId: string;
  assignedStaffName: string;
}> {
  return callWriteFunctionOrFallback(
    "claimServiceSession",
    { salonId: input.salonId, sessionId: input.session.id },
    () => claimServiceSessionDirect(input),
  );
}

export async function cancelServiceSession(input: {
  salonId: string;
  session: StaffSession;
  reason: "cancelled" | "no_show";
  note?: string;
}) {
  return callWriteFunctionOrFallback(
    "cancelServiceSession",
    {
      salonId: input.salonId,
      sessionId: input.session.id,
      reason: input.reason,
      note: input.note?.trim() || "",
    },
    () => cancelServiceSessionDirect(input),
  );
}

async function cancelServiceSessionDirect(input: {
  salonId: string;
  session: StaffSession;
  reason: "cancelled" | "no_show";
  note?: string;
}) {
  const db = getFirebaseDb();
  const signedStaff = await getSignedStaffForDirectWrite();
  if (!isFirebaseConfigured() || !db) {
    return { ok: true, status: "cancelled", cancellationReason: input.reason };
  }

  const sessionRef = doc(db, "chair_sessions", input.session.id);
  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists() || sessionSnap.data().salonId !== input.salonId) {
      throw new Error("Không tìm thấy lượt cắt");
    }
    const session = sessionSnap.data();
    const branchId = String(session.branchId || "");
    const canAccessBranch =
      signedStaff.role === "owner" || signedStaff.branchIds.includes(branchId);
    const canCancel =
      signedStaff.role === "owner" ||
      (canAccessBranch && session.status === "waiting") ||
      (canAccessBranch &&
        session.status === "serving" &&
        session.assignedStaffId === signedStaff.uid);
    if (!canCancel) {
      throw new Error("Bạn không được hủy lượt cắt này");
    }
    transaction.set(
      sessionRef,
      {
        status: "cancelled",
        isOpen: false,
        cancellationReason: input.reason,
        cancellationNote: input.note?.trim() || "",
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true, status: "cancelled", cancellationReason: input.reason };
}

async function claimServiceSessionDirect(input: {
  salonId: string;
  session: StaffSession;
}): Promise<{
  status: StaffSession["status"];
  assignedStaffId: string;
  assignedStaffName: string;
}> {
  const db = getFirebaseDb();
  const signedStaff = await getSignedStaffForDirectWrite();

  if (!isFirebaseConfigured() || !db) {
    return {
      status: "serving",
      assignedStaffId: signedStaff.uid || "demo-staff",
      assignedStaffName: signedStaff.name,
    };
  }

  const sessionRef = doc(db, "chair_sessions", input.session.id);
  let result = {
    status: "serving" as StaffSession["status"],
    assignedStaffId: signedStaff.uid,
    assignedStaffName: signedStaff.name,
  };

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists() || sessionSnap.data().salonId !== input.salonId) {
      throw new Error("Không tìm thấy lượt phục vụ");
    }

    const data = sessionSnap.data();
    if (
      signedStaff.role === "staff" &&
      !signedStaff.branchIds.includes(String(data.branchId || ""))
    ) {
      throw new Error("Bạn không được phân công tại chi nhánh này");
    }
    if (data.status === "serving") {
      if (data.assignedStaffId !== signedStaff.uid) {
        throw new Error(`Khách đã được ${String(data.assignedStaffName || "nhân viên khác")} nhận`);
      }
      result = {
        status: "serving",
        assignedStaffId: signedStaff.uid,
        assignedStaffName: String(data.assignedStaffName || signedStaff.name),
      };
      return;
    }
    if (data.status !== "waiting") {
      throw new Error("Lượt này không còn ở trạng thái chờ nhận");
    }

    transaction.set(
      sessionRef,
      {
        status: "serving",
        assignedStaffId: signedStaff.uid,
        assignedStaffName: signedStaff.name,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return result;
}

async function submitPointRequestDirect(input: {
  salonId: string;
  session: StaffSession;
  note: string;
  photoUrls?: string[];
  photoPaths?: string[];
  pointsRequested: number;
}): Promise<SubmitPointRequestResult> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      requestId: input.session.id,
      alreadySubmitted: false,
      status: "pending_approval",
      approvalMode: "owner_approval",
      pointsAdded: input.pointsRequested,
    };
  }

  const signedStaff = await getSignedStaffForDirectWrite();
  const sessionRef = doc(db, "chair_sessions", input.session.id);
  const requestRef = doc(db, "point_requests", input.session.id);

  const pointsRequested = Math.max(1, Math.floor(input.pointsRequested));

  await runTransaction(db, async (transaction) => {
    const [sessionSnap, requestSnap] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(requestRef),
    ]);

    if (!sessionSnap.exists()) {
      throw new Error("Không tìm thấy phiên phục vụ");
    }

    const sessionData = sessionSnap.data();
    const customerId = String(sessionData.customerId || "");
    if (sessionData.salonId !== input.salonId || customerId !== input.session.customerId) {
      throw new Error("Phiên phục vụ không thuộc đúng salon hoặc khách hàng");
    }
    if (
      signedStaff.role === "staff" &&
      !signedStaff.branchIds.includes(String(sessionData.branchId || ""))
    ) {
      throw new Error("Bạn không được phân công tại chi nhánh này");
    }
    if (sessionData.status !== "serving") {
      throw new Error(
        sessionData.status === "waiting"
          ? "Nhân viên cần nhận khách trước khi gửi yêu cầu điểm"
          : "Phiên này đã được gửi yêu cầu điểm hoặc đã xử lý",
      );
    }
    if (sessionData.assignedStaffId !== signedStaff.uid) {
      throw new Error(
        `Lượt này đang do ${String(sessionData.assignedStaffName || "nhân viên khác")} phụ trách`,
      );
    }
    if (!isFreshServiceSession(sessionData.createdAt)) {
      throw new Error("Phiên cắt đã quá thời gian cho phép cộng điểm");
    }
    if (requestSnap.exists()) {
      throw new Error("Phiên này đã có yêu cầu cộng điểm");
    }

    const customerRef = doc(db, "customers", customerId);
    const customerSnap = await transaction.get(customerRef);
    if (!customerSnap.exists() || customerSnap.data().salonId !== input.salonId) {
      throw new Error("Hồ sơ khách không thuộc salon này");
    }
    if (
      ((input.photoUrls?.length ?? 0) > 0 || (input.photoPaths?.length ?? 0) > 0) &&
      customerSnap.data().allowPhoto !== true
    ) {
      throw new Error("Khách chưa đồng ý lưu ảnh kiểu tóc");
    }

    transaction.set(requestRef, {
      salonId: input.salonId,
      branchId: String(sessionData.branchId || ""),
      branchName: String(sessionData.branchName || ""),
      customerId,
      sessionId: input.session.id,
      staffId: signedStaff.uid,
      staffName: signedStaff.name,
      note: input.note,
      photoUrls: input.photoUrls ?? [],
      photoPaths: input.photoPaths ?? [],
      pointsRequested,
      pointsAdded: pointsRequested,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(
      sessionRef,
      {
        status: "pending_approval",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return {
    requestId: input.session.id,
    alreadySubmitted: false,
    status: "pending_approval",
    approvalMode: "owner_approval",
    pointsAdded: pointsRequested,
  };
}

async function getSalonPointPerVisit(salonId: string) {
  try {
    const profile = await getSalonProfileDirect(salonId);
    return Math.max(1, Math.floor(profile.pointPerVisit || 1));
  } catch {
    return 1;
  }
}

async function getSignedStaffForDirectWrite() {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  const uid = auth?.currentUser?.uid || "";

  if (!db || !uid) {
    return { uid, name: "Nhân viên", role: "staff", branchIds: [] as string[] };
  }

  const snap = await getDoc(doc(db, "users", uid));
  const name = snap.exists() ? String(snap.data().name || "") : "";
  const data = snap.exists() ? snap.data() : {};
  const branchIds = Array.isArray(data.branchIds)
    ? data.branchIds.filter((value): value is string => typeof value === "string")
    : data.branchId
      ? [String(data.branchId)]
      : [];

  return {
    uid,
    name: name || "Nhân viên",
    role: data.role === "owner" ? "owner" : "staff",
    canAwardPointsDirectly: Boolean(data.canAwardPointsDirectly),
    branchIds,
  };
}

function isFreshServiceSession(createdAt: unknown) {
  const createdAtMs = toMillis(createdAt);

  if (!createdAtMs) {
    return false;
  }

  const nowMs = Date.now();
  return (
    createdAtMs <= nowMs + 5 * 60 * 1000 && nowMs - createdAtMs <= SESSION_POINT_REQUEST_WINDOW_MS
  );
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
      lastVisitAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(recordRef, {
      salonId: requestData.salonId,
      branchId: String(requestData.branchId || request.branchId),
      branchName: String(requestData.branchName || request.branchName),
      customerId: requestData.customerId,
      staffId: requestData.staffId || "",
      staffName: requestData.staffName || "",
      pointRequestId: request.id,
      note: requestData.note || "",
      photoUrls: customerSnap.data().allowPhoto === true ? request.photoUrls : [],
      pointsAdded,
      approvedBy: getFirebaseAuth()?.currentUser?.uid || "",
      createdAt: serverTimestamp(),
    });

    transaction.update(requestRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: getFirebaseAuth()?.currentUser?.uid || null,
      updatedAt: serverTimestamp(),
    });

    transaction.update(sessionRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
  });
}

export function normalizePointRejectionReason(value: string) {
  const reason = value.trim().replace(/\s+/g, " ");
  if (reason.length < 5 || reason.length > 200) {
    throw new Error("Lý do từ chối phải có từ 5 đến 200 ký tự.");
  }
  return reason;
}

export async function rejectPointRequest(request: PointRequest, value = "Chủ salon từ chối") {
  const reason = normalizePointRejectionReason(value);
  return callWriteFunctionOrFallback(
    "rejectPointRequest",
    {
      salonId: request.salonId,
      requestId: request.id,
      reason,
    },
    () => rejectPointRequestDirect(request, reason),
  );
}

async function rejectPointRequestDirect(request: PointRequest, reason: string) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  const requestRef = doc(db, "point_requests", request.id);
  const sessionRef = doc(db, "chair_sessions", request.sessionId);

  await runTransaction(db, async (transaction) => {
    transaction.update(requestRef, {
      status: "rejected",
      rejectionReason: reason,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(sessionRef, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
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
      rewardValidityDays: normalized.rewardValidityDays,
      deductPointsAfterSpin: normalized.deductPointsAfterSpin,
      slots: normalized.slots,
    },
    () => saveLuckyWheelConfigDirect(salonId, normalized),
  );
}

export async function redeemRewardCode(input: {
  salonId: string;
  rewardCode: string;
  branchId?: string;
}): Promise<RedeemRewardResult> {
  const rewardCode = normalizeRewardCode(input.rewardCode);

  if (!rewardCode) {
    throw new Error("Vui lòng nhập mã quà");
  }

  const pendingOperation = getOrCreatePendingOperationKey(
    `redeem:${input.salonId}:${localScopeHash(rewardCode)}`,
  );
  const result = await callWriteFunctionOrFallback(
    "redeemRewardCode",
    {
      salonId: input.salonId,
      rewardCode,
      branchId: input.branchId,
      idempotencyKey: pendingOperation.key,
    },
    () => redeemRewardCodeDirect(input.salonId, rewardCode),
  );
  safeStorageRemove(pendingOperation.storageKey);
  const maybeResult = result as Partial<RedeemRewardResult> | undefined;
  return {
    rewardId: maybeResult?.rewardId || "",
    rewardCode,
    rewardName: maybeResult?.rewardName || "",
    customerName: maybeResult?.customerName || "",
    alreadyRedeemed: maybeResult?.alreadyRedeemed === true,
  };
}

export async function restoreRewardCode(input: { salonId: string; rewardCode: string }) {
  const rewardCode = normalizeRewardCode(input.rewardCode);
  if (!rewardCode) {
    throw new Error("Mã quà không hợp lệ");
  }

  return callFunction<
    { salonId: string; rewardCode: string; reason: string },
    { rewardCode: string; status: "unused" }
  >("restoreRewardCode", {
    salonId: input.salonId,
    rewardCode,
    reason: "Chủ salon hoàn tác thao tác bấm nhầm",
  });
}

async function redeemRewardCodeDirect(
  salonId: string,
  rewardCode: string,
): Promise<RedeemRewardResult> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      rewardId: "mock-reward",
      rewardCode,
      rewardName: "Mã quà demo",
      customerName: "Khách demo",
    };
  }

  const rewardSnap = await getDocs(
    query(
      collection(db, "reward_history"),
      where("salonId", "==", salonId),
      where("rewardCode", "==", rewardCode),
      firestoreLimit(1),
    ),
  );

  if (rewardSnap.empty) {
    throw new Error("Không tìm thấy mã quà");
  }

  const rewardDoc = rewardSnap.docs[0];
  const reward = rewardDoc.data();

  if (reward.status !== "unused") {
    throw new Error("Mã quà đã được xử lý");
  }

  await updateDoc(rewardDoc.ref, {
    status: "used",
    usedAt: serverTimestamp(),
    usedBy: getFirebaseAuth()?.currentUser?.uid || null,
    updatedAt: serverTimestamp(),
  });

  const customer = await getCustomer(String(reward.customerId || ""), salonId);

  return {
    rewardId: rewardDoc.id,
    rewardCode,
    rewardName: String(reward.rewardName || ""),
    customerName: customer?.name,
  };
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
      rewardValidityDays: config.rewardValidityDays,
      deductPointsAfterSpin: config.deductPointsAfterSpin,
      slots: config.slots,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function createMirrorDirect(salonId: string, name: string): Promise<SalonMirror> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return mockMirrors(salonId)[0];
  }

  const mirrorRef = doc(collection(db, "mirrors"));
  const qrToken = randomToken();
  const qrUrl = buildQrUrl(salonId, mirrorRef.id, qrToken);

  await setDoc(mirrorRef, {
    salonId,
    name,
    qrToken,
    qrUrl,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: mirrorRef.id,
    salonId,
    name,
    qrToken,
    qrUrl,
    isActive: true,
    createdAtMs: Date.now(),
  };
}

async function updateMirrorDirect(input: {
  salonId: string;
  mirrorId: string;
  name?: string;
  isActive?: boolean;
  regenerateQr?: boolean;
}): Promise<SalonMirror> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return mockMirrors(input.salonId)[0];
  }

  const mirrorRef = doc(db, "mirrors", input.mirrorId);
  const snap = await getDoc(mirrorRef);

  if (!snap.exists() || snap.data().salonId !== input.salonId) {
    throw new Error("Không tìm thấy gương/ghế");
  }

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name?.trim()) {
    payload.name = input.name.trim();
  }
  if (typeof input.isActive === "boolean") {
    payload.isActive = input.isActive;
  }
  if (input.regenerateQr) {
    const qrToken = randomToken();
    payload.qrToken = qrToken;
    payload.qrUrl = buildQrUrl(input.salonId, input.mirrorId, qrToken);
  }

  await setDoc(mirrorRef, payload, { merge: true });
  const updatedSnap = await getDoc(mirrorRef);
  return mapMirror(updatedSnap as QueryDocumentSnapshot<DocumentData>);
}

async function getStaffProfilesDirect(salonId: string): Promise<{ staff: StaffProfile[] }> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      staff: [
        {
          uid: "demo-staff",
          salonId,
          name: "Nhân viên demo",
          email: "staff@haircut.demo",
          phone: "",
          role: "staff",
          isActive: true,
          canRedeemRewards: true,
          canAwardPointsDirectly: true,
          branchId: "demo-branch-main",
          branchIds: ["demo-branch-main"],
          inviteStatus: "accepted",
        },
      ],
    };
  }

  const snap = await getDocs(query(collection(db, "users"), where("salonId", "==", salonId)));

  return {
    staff: snap.docs.map(mapStaffProfile).filter((staff): staff is StaffProfile => Boolean(staff)),
  };
}

async function updateStaffProfileDirect(input: {
  salonId: string;
  uid: string;
  name?: string;
  phone?: string;
  isActive?: boolean;
  canRedeemRewards?: boolean;
  canAwardPointsDirectly?: boolean;
  branchIds?: string[];
}) {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  const staffRef = doc(db, "users", input.uid);
  const snap = await getDoc(staffRef);

  if (!snap.exists() || snap.data().salonId !== input.salonId || snap.data().role !== "staff") {
    throw new Error("Không tìm thấy nhân viên");
  }

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name?.trim()) {
    payload.name = input.name.trim();
  }
  if (input.phone !== undefined) {
    payload.phone = input.phone.trim();
  }
  if (typeof input.isActive === "boolean") {
    payload.isActive = input.isActive;
  }
  if (typeof input.canRedeemRewards === "boolean") {
    payload.canRedeemRewards = input.canRedeemRewards;
  }
  if (typeof input.canAwardPointsDirectly === "boolean") {
    payload.canAwardPointsDirectly = input.canAwardPointsDirectly;
  }
  if (input.branchIds?.length) {
    payload.branchId = input.branchIds[0];
    payload.branchIds = input.branchIds;
  }

  await setDoc(staffRef, payload, { merge: true });
}

async function deleteCustomerDataDirect(
  salonId: string,
  customerId: string,
): Promise<DeleteCustomerDataResult> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      customerId,
      status: "completed",
      deletedRecords: 0,
      deletedRewards: 0,
      deletedRequests: 0,
      deletedSessions: 0,
      deletedStorageFiles: 0,
    };
  }

  const customerRef = doc(db, "customers", customerId);
  const customerSnap = await getDoc(customerRef);

  if (!customerSnap.exists() || customerSnap.data().salonId !== salonId) {
    throw new Error("Không tìm thấy hồ sơ khách trong salon này");
  }

  const deletedRecords = await deleteCustomerDocsDirect("haircut_records", salonId, customerId);
  const deletedRewards = await deleteCustomerDocsDirect("reward_history", salonId, customerId);
  const deletedRequests = await deleteCustomerDocsDirect("point_requests", salonId, customerId);
  const deletedSessions = await deleteCustomerDocsDirect("chair_sessions", salonId, customerId);
  await deleteDoc(customerRef);

  return {
    customerId,
    status: "completed",
    deletedRecords,
    deletedRewards,
    deletedRequests,
    deletedSessions,
    deletedStorageFiles: 0,
  };
}

async function deleteCustomerDocsDirect(
  collectionName: string,
  salonId: string,
  customerId: string,
) {
  const db = getFirebaseDb();

  if (!db) {
    return 0;
  }

  const snap = await getDocs(
    query(
      collection(db, collectionName),
      where("salonId", "==", salonId),
      where("customerId", "==", customerId),
    ),
  );

  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  return snap.size;
}

async function lookupRewardCodeDirect(
  salonId: string,
  branchId: string | undefined,
  rewardCode: string,
): Promise<RewardCodeInfo> {
  const db = getFirebaseDb();

  if (!isFirebaseConfigured() || !db) {
    return {
      found: true,
      rewardCode,
      rewardName: "Mã quà demo",
      status: "unused",
      customerName: "Khách demo",
      createdAtMs: Date.now(),
    };
  }

  const snap = await getDocs(
    query(
      collection(db, "reward_history"),
      where("salonId", "==", salonId),
      where("rewardCode", "==", rewardCode),
      ...(branchId ? [where("branchId", "==", branchId)] : []),
      firestoreLimit(1),
    ),
  );

  if (snap.empty) {
    return {
      found: false,
      rewardCode,
      status: "not_found",
    };
  }

  const rewardDoc = snap.docs[0];
  const reward = rewardDoc.data();
  const customer = await getCustomer(String(reward.customerId || ""), salonId);

  return {
    found: true,
    rewardId: rewardDoc.id,
    rewardCode,
    rewardName: String(reward.rewardName || ""),
    status: normalizeRewardStatus(reward.status),
    customerName: customer?.name,
    createdAtMs: toMillis(reward.createdAt),
    usedAtMs: toMillis(reward.usedAt),
  };
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

function mapMirror(docSnap: { id: string; data: () => DocumentData }): SalonMirror {
  const data = docSnap.data();
  const salonId = String(data.salonId || "");
  const qrToken = String(data.qrToken || "");

  return {
    id: docSnap.id,
    salonId,
    name: String(data.name || "Gương"),
    qrToken,
    qrUrl: qrToken ? buildQrUrl(salonId, docSnap.id, qrToken) : String(data.qrUrl || ""),
    isActive: Boolean(data.isActive),
    createdAtMs: toMillis(data.createdAt),
  };
}

function normalizeMirrorResult(salonId: string, result: unknown, fallbackId = ""): SalonMirror {
  const data = isRecord(result) ? result : {};
  const mirrorId = String(data.mirrorId || data.id || fallbackId);
  const qrToken = String(data.qrToken || "");

  return {
    id: mirrorId,
    salonId,
    name: String(data.name || "Gương"),
    qrToken,
    qrUrl: String(data.qrUrl || buildQrUrl(salonId, mirrorId, qrToken)),
    isActive: data.isActive === undefined ? true : Boolean(data.isActive),
    createdAtMs: null,
  };
}

function mapStaffProfile(docSnap: QueryDocumentSnapshot<DocumentData>): StaffProfile | null {
  const data = docSnap.data();

  if (data.role !== "staff") {
    return null;
  }

  return {
    uid: docSnap.id,
    salonId: String(data.salonId || ""),
    name: String(data.name || "Nhân viên"),
    email: String(data.email || ""),
    phone: String(data.phone || ""),
    role: "staff",
    isActive: Boolean(data.isActive),
    canRedeemRewards: Boolean(data.canRedeemRewards),
    canAwardPointsDirectly: Boolean(data.canAwardPointsDirectly),
    branchId: String(data.branchId || ""),
    branchIds: Array.isArray(data.branchIds)
      ? data.branchIds.filter((value): value is string => typeof value === "string")
      : data.branchId
        ? [String(data.branchId)]
        : [],
    inviteStatus: data.inviteStatus === "pending" ? "pending" : "accepted",
  };
}

function mapSession(docSnap: QueryDocumentSnapshot<DocumentData>): StaffSession {
  const data = docSnap.data();
  const summary =
    typeof data.customerSummary === "object" && data.customerSummary !== null
      ? data.customerSummary
      : {};
  const customerId = String(data.customerId || "");

  return {
    id: docSnap.id,
    salonId: String(data.salonId || ""),
    branchId: String(data.branchId || ""),
    branchName: String(data.branchName || data.mirrorName || "Chi nhánh"),
    branchAddress: String(data.branchAddress || ""),
    mirrorId: String(data.mirrorId || ""),
    mirrorName: String(data.mirrorName || ""),
    customerId,
    status: normalizeSessionStatus(data.status, data.assignedStaffId),
    assignedStaffId: String(data.assignedStaffId || ""),
    assignedStaffName: String(data.assignedStaffName || ""),
    claimedAtMs: toMillis(data.claimedAt),
    createdAtMs: toMillis(data.createdAt),
    expiresAtMs: toMillis(data.expiresAt),
    cancellationReason: String(data.cancellationReason || ""),
    customer: embeddedCustomerSummary(summary, customerId),
  };
}

function mapPointRequest(docSnap: QueryDocumentSnapshot<DocumentData>): PointRequest {
  const data = docSnap.data();
  const salonId = String(data.salonId || "");
  const sessionId = String(data.sessionId || "");
  const customerId = String(data.customerId || "");
  const summary =
    typeof data.customerSummary === "object" && data.customerSummary !== null
      ? data.customerSummary
      : null;
  const legacyPhotoUrls = trustedPointRequestPhotoUrls(data.photoUrls, {
    salonId,
    customerId,
    sessionId,
  });

  return {
    id: docSnap.id,
    salonId,
    branchId: String(data.branchId || ""),
    branchName: String(data.branchName || "Chi nhánh"),
    sessionId,
    customerId,
    staffName: String(data.staffName || ""),
    note: String(data.note || ""),
    photoUrls: legacyPhotoUrls,
    legacyPhotoUrls,
    photoPaths: trustedPointRequestPhotoPaths(data.photoPaths, { salonId, customerId, sessionId }),
    pointsAdded: Number(data.pointsAdded ?? data.pointsRequested ?? 1),
    status: normalizeRequestStatus(data.status),
    createdAtMs: toMillis(data.createdAt),
    customer: summary ? embeddedCustomerSummary(summary, customerId) : undefined,
  };
}

function embeddedCustomerSummary(value: Record<string, unknown>, customerId: string) {
  return {
    id: customerId,
    name: String(value.name || "Khách hàng"),
    phoneLast4: String(value.phoneLast4 || ""),
    points: Math.max(0, Number(value.points ?? 0)),
    allowPhoto: Boolean(value.allowPhoto),
  };
}

function trustedPointRequestPhotoUrls(
  value: unknown,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const bucketName = String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "");
  if (!bucketName) {
    return [];
  }

  const prefix = `salons/${input.salonId}/customers/${input.customerId}/haircuts/${input.sessionId}/`;
  return value.slice(0, 3).filter((photoUrl): photoUrl is string => {
    if (typeof photoUrl !== "string") {
      return false;
    }

    try {
      const parsed = new URL(photoUrl);
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "firebasestorage.googleapis.com" ||
        !match ||
        decodeURIComponent(match[1]) !== bucketName
      ) {
        return false;
      }

      const objectName = decodeURIComponent(match[2]);
      const fileName = objectName.startsWith(prefix) ? objectName.slice(prefix.length) : "";
      return /^photo-[A-Za-z0-9-]{12,80}\.jpg$/.test(fileName);
    } catch {
      return false;
    }
  });
}

async function attachCustomersToRequests(requests: PointRequest[]) {
  const pairs = await Promise.all(
    requests.map(async (request) => {
      const customer = await getCustomer(request.customerId, request.salonId);
      const photoUrls = await resolvePointRequestPhotos(
        request.photoUrls,
        request.photoPaths ?? [],
      );
      return {
        ...request,
        photoUrls,
        customer: customer ?? request.customer,
      };
    }),
  );

  return pairs;
}

function trustedPointRequestPhotoPaths(
  value: unknown,
  input: { salonId: string; customerId: string; sessionId: string },
) {
  if (!Array.isArray(value)) return [];
  const prefix = `salons/${input.salonId}/customers/${input.customerId}/sessions/${input.sessionId}/`;
  return value
    .slice(0, 3)
    .filter(
      (path): path is string =>
        typeof path === "string" &&
        path.startsWith(prefix) &&
        /^op-[a-f0-9]{40}\.jpg$/.test(path.slice(prefix.length)),
    );
}

async function resolvePointRequestPhotos(legacyUrls: string[], photoPaths: string[]) {
  const storage = getFirebaseStorage();
  if (!storage || photoPaths.length === 0) return legacyUrls;
  const resolved = await Promise.all(
    photoPaths.map(async (path) => {
      try {
        return await getDownloadURL(ref(storage, path));
      } catch {
        return null;
      }
    }),
  );
  return [
    ...new Set([...legacyUrls, ...resolved.filter((url): url is string => Boolean(url))]),
  ].slice(0, 3);
}

async function getCustomer(
  customerId: string,
  salonId: string,
): Promise<CustomerSummary | undefined> {
  const db = getFirebaseDb();

  if (!db || !customerId) {
    return undefined;
  }

  const snap = await getDoc(doc(db, "customers", customerId));

  if (!snap.exists() || snap.data().salonId !== salonId) {
    return undefined;
  }

  const data = snap.data();

  return {
    id: snap.id,
    name: String(data.name || "Khách hàng"),
    phone: String(data.phone || ""),
    phoneLast4: String(data.phoneLast4 || ""),
    points: Number(data.points ?? 0),
    allowPhoto: Boolean(data.allowPhoto),
  };
}

function normalizeSessionStatus(value: unknown, assignedStaffId?: unknown): StaffSession["status"] {
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

function normalizeRequestStatus(value: unknown): PointRequest["status"] {
  if (value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
}

function normalizeRewardStatus(value: unknown): CustomerRewardSummary["status"] {
  if (value === "used" || value === "expired" || value === "revoked") {
    return value;
  }

  return "unused";
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

function normalizeRewardCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function buildQrUrl(salonId: string, mirrorId: string, qrToken: string) {
  const params = new URLSearchParams({ salonId, mirrorId, qrToken });
  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "");

  if (miniAppId) {
    return `https://zalo.me/s/${miniAppId}?${params.toString()}`;
  }

  return `${window.location.origin}/?${params.toString()}`;
}

function normalizeBranch(salonId: string, value: unknown, fallbackId = ""): SalonBranch {
  const data = isRecord(value) ? value : {};
  return {
    id: String(data.id || data.branchId || fallbackId),
    salonId,
    name: String(data.name || "Chi nhánh"),
    address: String(data.address || ""),
    phone: String(data.phone || ""),
    qrUrl: String(data.qrUrl || ""),
    isActive: data.isActive !== false,
  };
}

function mockBranchQrSettings(salonId: string): BranchQrSettings {
  const salonToken = "demo-salon-token";
  const branchToken = "demo-branch-token";
  const branchId = "demo-branch-main";
  const miniAppId = String(import.meta.env.VITE_ZALO_MINI_APP_ID || "");
  const base = miniAppId ? `https://zalo.me/s/${miniAppId}` : window.location.origin;
  return {
    salonQrUrl: `${base}/?qrType=salon&salonId=${salonId}&qrToken=${salonToken}`,
    branches: [
      {
        id: branchId,
        salonId,
        name: "Chi nhánh chính",
        address: "",
        phone: "",
        isActive: true,
        qrUrl: `${base}/?qrType=branch&salonId=${salonId}&branchId=${branchId}&qrToken=${branchToken}`,
      },
    ],
  };
}

function randomToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "");
  }

  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function localScopeHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getOrCreatePendingOperationKey(scope: string) {
  const storageKey = `haircut_pending_operation:${scope}`;
  const existing = safeStorageGet(storageKey);
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) {
    return { storageKey, key: existing };
  }
  const key = randomToken();
  safeStorageSet(storageKey, key);
  return { storageKey, key };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mockMirrors(salonId: string): SalonMirror[] {
  return [
    {
      id: "demo-mirror-1",
      salonId,
      name: "Gương 1",
      qrToken: "demo-token",
      qrUrl: buildQrUrl(salonId, "demo-mirror-1", "demo-token"),
      isActive: true,
      createdAtMs: Date.now(),
    },
  ];
}

function mockSessions(): StaffSession[] {
  return [
    {
      id: "mock-session",
      salonId: "demo-salon",
      branchId: "demo-branch-main",
      branchName: "Chi nhánh chính",
      branchAddress: "",
      mirrorId: "demo-mirror-1",
      mirrorName: "Gương 1",
      customerId: "mock-customer",
      status: "waiting",
      assignedStaffId: "",
      assignedStaffName: "",
      claimedAtMs: null,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + SESSION_POINT_REQUEST_WINDOW_MS,
      cancellationReason: "",
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
