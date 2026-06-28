export type TabKey = "home" | "history" | "wheel" | "rewards";

export type QrContext = {
  salonId: string;
  mirrorId: string;
  qrToken: string;
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
  zaloUserId: string;
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
};

export type SpinResult = {
  rewardId: string;
  rewardName: string;
  rewardCode: string;
  pointsAfter: number;
  selectedIndex?: number;
};

export type LuckyWheelSlot = {
  label: string;
  active: boolean;
};

export type LuckyWheelConfig = {
  requiredPoints: number;
  deductPointsAfterSpin: boolean;
  slots: LuckyWheelSlot[];
};

export const defaultLuckyWheelConfig: LuckyWheelConfig = {
  requiredPoints: 5,
  deductPointsAfterSpin: true,
  slots: [
    { label: "Giảm 10%", active: true },
    { label: "Gội đầu miễn phí", active: true },
    { label: "Tặng sáp tóc", active: true },
    { label: "Giảm 20%", active: true },
    { label: "Chúc bạn may mắn lần sau", active: true },
    { label: "Hấp dầu miễn phí", active: true },
  ],
};
