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
  sessionStatus?: "waiting" | "serving" | "pending_approval" | "completed" | "cancelled";
  assignedStaffName?: string;
  claimedAtMs?: number | null;
  customer: CustomerProfile;
};

export type HaircutRecord = {
  id: string;
  createdAt: string;
  staffName: string;
  note: string;
  photoUrls: string[];
  pointsAdded: number;
};

export type Reward = {
  id: string;
  rewardName: string;
  rewardCode: string;
  status: "unused" | "used" | "expired";
  createdAt: string;
  expiresAt?: string;
};

export type SpinResult = {
  rewardId: string;
  rewardName: string;
  rewardCode: string;
  pointsAfter: number;
  isWinning: boolean;
  selectedIndex?: number;
};

export type LuckyWheelSlot = {
  label: string;
  active: boolean;
  type: "reward" | "no_prize";
};

export type LuckyWheelConfig = {
  requiredPoints: number;
  rewardValidityDays: number;
  deductPointsAfterSpin: boolean;
  slots: LuckyWheelSlot[];
};

export const defaultLuckyWheelConfig: LuckyWheelConfig = {
  requiredPoints: 5,
  rewardValidityDays: 90,
  deductPointsAfterSpin: true,
  slots: [
    { label: "Giảm 10%", active: true, type: "reward" },
    { label: "Gội đầu miễn phí", active: true, type: "reward" },
    { label: "Tặng sáp tóc", active: true, type: "reward" },
    { label: "Giảm 20%", active: true, type: "reward" },
    { label: "Chúc bạn may mắn lần sau", active: true, type: "no_prize" },
    { label: "Hấp dầu miễn phí", active: true, type: "reward" },
  ],
};
