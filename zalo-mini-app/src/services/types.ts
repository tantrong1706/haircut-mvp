export type TabKey = "home" | "history" | "wheel" | "rewards";

export type QrType = "salon" | "branch" | "legacy-mirror";

export type QrContext = {
  qrType: QrType;
  salonId: string;
  branchId: string;
  mirrorId: string;
  qrToken?: string;
};

export type CustomerProfile = {
  customerId: string;
  name: string;
  phoneLast4?: string;
  points: number;
  allowPhoto: boolean;
};

export type AppSession = {
  qr: QrContext;
  sessionId: string;
  branchName?: string;
  branchAddress?: string;
  mirrorName?: string;
  zaloUserId: string;
  identityBinding?: string;
  sessionStatus?: "waiting" | "serving" | "pending_approval" | "completed" | "cancelled";
  assignedStaffName?: string;
  claimedAtMs?: number | null;
  features?: SystemFeatures;
  customer: CustomerProfile;
};

export type HaircutRecord = {
  id: string;
  createdAt: string;
  salonName?: string;
  branchId?: string;
  branchName?: string;
  staffName: string;
  serviceName?: string;
  rewardName?: string;
  note: string;
  photoUrls: string[];
  pointsAdded: number;
};

export type Reward = {
  id: string;
  rewardName: string;
  rewardCode: string;
  status: "unused" | "used" | "expired" | "revoked";
  sourceBranchId?: string;
  sourceBranchName?: string;
  redemptionScope: "salon" | "branches";
  allowedBranchIds: string[];
  createdAt: string;
  usedAt?: string;
  usedBranchId?: string;
  usedBranchName?: string;
  expiresAt?: string;
};

export type SpinResult = {
  rewardId: string;
  rewardName: string;
  rewardCode: string;
  pointsAfter: number;
  isWinning: boolean;
  selectedIndex: number;
  selectedSlotId: string;
  configVersion: number;
};

export type LuckyWheelSlot = {
  slotId: string;
  label: string;
  active: boolean;
  type: "reward" | "no_prize";
  weight: number;
};

export type LuckyWheelConfig = {
  configVersion: number;
  requiredPoints: number;
  rewardValidityDays: number;
  deductPointsAfterSpin: boolean;
  slots: LuckyWheelSlot[];
};

export const defaultLuckyWheelConfig: LuckyWheelConfig = {
  configVersion: 1,
  requiredPoints: 5,
  rewardValidityDays: 90,
  deductPointsAfterSpin: true,
  slots: [
    { slotId: "slot-1", label: "Giảm 10%", active: true, type: "reward", weight: 25 },
    {
      slotId: "slot-2",
      label: "Gội đầu miễn phí",
      active: true,
      type: "reward",
      weight: 10,
    },
    { slotId: "slot-3", label: "Tặng sáp tóc", active: true, type: "reward", weight: 10 },
    { slotId: "slot-4", label: "Giảm 20%", active: true, type: "reward", weight: 5 },
    {
      slotId: "slot-5",
      label: "Chúc bạn may mắn lần sau",
      active: true,
      type: "no_prize",
      weight: 40,
    },
    {
      slotId: "slot-6",
      label: "Hấp dầu miễn phí",
      active: true,
      type: "reward",
      weight: 10,
    },
  ],
};
import type { SystemFeatures } from "@haircut/contracts";
