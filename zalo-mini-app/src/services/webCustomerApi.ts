import { DEFAULT_SYSTEM_FEATURES, type SystemFeatures } from "@haircut/contracts";
import { callCustomerWebFunction, getCustomerFirebaseAuth } from "./firebase";
import type {
  AppSession,
  CustomerProfile,
  HaircutRecord,
  LuckyWheelConfig,
  QrContext,
  Reward,
  SpinResult,
} from "./types";

type WebQrView = {
  salonId: string;
  salonName: string;
  salonAvatarUrl: string;
  branchId: string;
  branchName: string;
  branchAddress: string;
};

export type WebCustomerContext = {
  qr: WebQrView;
  customer: CustomerProfile;
  activeSession: AppSession | null;
};

type WebSessionResult = {
  salonName?: string;
  firebaseUid?: string;
  qr?: Pick<QrContext, "salonId" | "branchId">;
  sessionId: string;
  sessionStatus: AppSession["sessionStatus"];
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  assignedStaffName?: string;
  claimedAtMs?: number | null;
  customer: CustomerProfile;
  wheelConfig?: LuckyWheelConfig;
  features?: SystemFeatures;
};

export async function resolveWebCustomerContext(qr: QrContext): Promise<WebCustomerContext> {
  if (testAdapterEnabled()) return mockWebCustomerContext(qr);
  return callCustomerWebFunction<QrContext, WebCustomerContext>("getWebCustomerContext", qr);
}

export async function checkInWebCustomer(qr: QrContext): Promise<AppSession> {
  if (testAdapterEnabled()) return mockWebCustomerCheckin(qr);
  const result = await callCustomerWebFunction<QrContext, WebSessionResult>(
    "checkInWebCustomer",
    qr,
  );
  return appSessionFromWebResult(qr, result);
}

export async function getWebCustomerAccount(salonId: string): Promise<AppSession> {
  const qr: QrContext = { qrType: "salon", salonId, branchId: "", mirrorId: "" };
  if (testAdapterEnabled()) {
    const context = mockWebCustomerContext(qr);
    if (context.activeSession) return context.activeSession;
    return {
      identityProvider: "firebase",
      firebaseUid: "web-test-uid",
      qr,
      salonName: context.qr.salonName,
      sessionId: "",
      zaloUserId: "",
      customer: context.customer,
      features: { ...DEFAULT_SYSTEM_FEATURES },
    };
  }
  const result = await callCustomerWebFunction<{ salonId: string }, WebSessionResult>(
    "getWebCustomerSession",
    { salonId },
  );
  return appSessionFromWebResult(qr, result);
}

export async function getWebCustomerSessionState(session: AppSession) {
  if (testAdapterEnabled()) {
    return {
      sessionStatus: session.sessionStatus,
      branchId: session.qr.branchId,
      branchName: session.branchName,
      branchAddress: session.branchAddress,
      assignedStaffName: session.assignedStaffName,
      claimedAtMs: session.claimedAtMs,
      customer: session.customer,
      wheelConfig: undefined,
      features: session.features,
    };
  }
  return callCustomerWebFunction<{ salonId: string; sessionId: string }, WebSessionResult>(
    "getWebCustomerSession",
    {
      salonId: session.qr.salonId,
      sessionId: session.sessionId,
    },
  );
}

export async function getWebCustomerHistory(session: AppSession): Promise<HaircutRecord[]> {
  if (testAdapterEnabled()) return [];
  const result = await callCustomerWebFunction<
    { salonId: string; limit: number },
    {
      records: Array<{
        id: string;
        createdAtMs: number | null;
        salonName?: string;
        branchId?: string;
        branchName?: string;
        staffName?: string;
        serviceName?: string;
        rewardName?: string;
        note?: string;
        photoUrls?: string[];
        pointsAdded?: number;
      }>;
    }
  >("getWebCustomerHistory", { salonId: session.qr.salonId, limit: 20 });
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
}

export async function getWebCustomerRewards(session: AppSession): Promise<Reward[]> {
  if (testAdapterEnabled()) return [];
  const result = await callCustomerWebFunction<
    { salonId: string; limit: number },
    {
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
    }
  >("getWebCustomerRewards", { salonId: session.qr.salonId, limit: 20 });
  return result.rewards.map((reward) => ({
    id: reward.id,
    rewardName: reward.rewardName,
    rewardCode: reward.rewardCode,
    status: reward.status,
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
}

export function spinWebCustomerWheel(
  session: AppSession,
  configVersion: number,
  idempotencyKey: string,
) {
  return callCustomerWebFunction<
    { salonId: string; configVersion: number; idempotencyKey: string },
    SpinResult
  >("spinWebLuckyWheel", {
    salonId: session.qr.salonId,
    configVersion,
    idempotencyKey,
  });
}

function appSessionFromWebResult(qr: QrContext, result: WebSessionResult): AppSession {
  return {
    identityProvider: "firebase",
    salonName: result.salonName || "",
    firebaseUid: result.firebaseUid || getCustomerFirebaseAuth()?.currentUser?.uid || "",
    qr: {
      qrType: "branch",
      salonId: qr.salonId,
      branchId: result.qr?.branchId || result.branchId || qr.branchId,
      mirrorId: "",
    },
    sessionId: result.sessionId,
    branchName: result.branchName || "",
    branchAddress: result.branchAddress || "",
    zaloUserId: "",
    sessionStatus: result.sessionId ? result.sessionStatus || "pending_approval" : undefined,
    assignedStaffName: result.assignedStaffName || "",
    claimedAtMs: result.claimedAtMs ?? null,
    customer: result.customer,
    features: result.features ?? { ...DEFAULT_SYSTEM_FEATURES },
  };
}

function mockWebCustomerContext(qr: QrContext): WebCustomerContext {
  const customerId = `web-test-${qr.salonId}`;
  const points = Number(localStorage.getItem(`haircut_test_web_points:${qr.salonId}`) || "0");
  const activeRaw = localStorage.getItem(`haircut_test_web_session:${qr.salonId}`);
  const customer: CustomerProfile = {
    customerId,
    name: "Khách 4567",
    phoneLast4: "4567",
    points,
    allowPhoto: false,
  };
  return {
    qr: {
      salonId: qr.salonId,
      salonName: qr.salonId === "salon-web-b" ? "Salon Web B" : "Salon Web A",
      salonAvatarUrl: "",
      branchId: qr.branchId || "demo-branch-main",
      branchName: "Chi nhánh chính",
      branchAddress: "1 Đường kiểm thử",
    },
    customer,
    activeSession: activeRaw ? (JSON.parse(activeRaw) as AppSession) : null,
  };
}

function mockWebCustomerCheckin(qr: QrContext): AppSession {
  const context = mockWebCustomerContext(qr);
  if (context.activeSession) return context.activeSession;
  const session: AppSession = {
    identityProvider: "firebase",
    firebaseUid: "web-test-uid",
    qr: { ...qr, qrType: "branch", branchId: context.qr.branchId },
    sessionId: `web-test-session-${qr.salonId}`,
    branchName: context.qr.branchName,
    branchAddress: context.qr.branchAddress,
    zaloUserId: "",
    sessionStatus: "pending_approval",
    customer: { ...context.customer, allowPhoto: true },
    features: { ...DEFAULT_SYSTEM_FEATURES },
  };
  localStorage.setItem(`haircut_test_web_session:${qr.salonId}`, JSON.stringify(session));
  return session;
}

function formatDate(value: number | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function testAdapterEnabled() {
  return (
    import.meta.env.VITE_APP_ENV === "test" &&
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode ===
      true
  );
}
