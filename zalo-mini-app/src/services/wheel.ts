import { LuckyWheelConfig, LuckyWheelSlot, defaultLuckyWheelConfig } from "./types";

export const WHEEL_ANIMATION_DURATION_MS = 6_500;

const WHEEL_ANIMATION_OFFSETS = [0, 0.07, 0.48, 0.7, 0.84, 0.94, 1] as const;
const WHEEL_DISTANCE_FRACTIONS = [0, 0.035, 0.7, 0.88, 0.955, 0.988, 1] as const;

export type WheelAnimationPlan = {
  from: number;
  to: number;
  offsets: number[];
  angles: number[];
};

export function normalizeLuckyWheelConfig(value: unknown): LuckyWheelConfig {
  const source = isRecord(value) ? value : {};
  const rawSlots = Array.isArray(source.slots) ? source.slots : defaultLuckyWheelConfig.slots;
  const slots = rawSlots.slice(0, 6).map((slot, index) => normalizeSlot(slot, index));

  while (slots.length < 6) {
    slots.push(defaultLuckyWheelConfig.slots[slots.length]);
  }

  return {
    requiredPoints: Math.min(10_000, Math.max(1, Number(source.requiredPoints ?? 5))),
    rewardValidityDays: Math.min(
      365,
      Math.max(1, Math.floor(Number(source.rewardValidityDays ?? 90))),
    ),
    deductPointsAfterSpin: Boolean(source.deductPointsAfterSpin ?? true),
    slots,
  };
}

export function activeWheelSlots(config: LuckyWheelConfig): LuckyWheelSlot[] {
  return config.slots.filter((slot) => slot.active && slot.label.trim().length > 0);
}

export function targetWheelRotation(
  currentRotation: number,
  selectedIndex: number,
  slotCount: number,
  fullRotations = 6,
) {
  if (slotCount <= 0) return currentRotation;

  const safeIndex = normalizeIndex(selectedIndex, slotCount);
  const slice = 360 / slotCount;
  const selectedCenter = safeIndex * slice + slice / 2;
  const target = normalizeDegrees(-selectedCenter);
  const current = normalizeDegrees(currentRotation);

  return (
    currentRotation +
    Math.max(1, Math.floor(fullRotations)) * 360 +
    normalizeDegrees(target - current)
  );
}

export function createWheelAnimationPlan(from: number, to: number): WheelAnimationPlan {
  const distance = Math.max(0, to - from);
  return {
    from,
    to,
    offsets: [...WHEEL_ANIMATION_OFFSETS],
    angles: WHEEL_DISTANCE_FRACTIONS.map((fraction) => from + distance * fraction),
  };
}

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function normalizeIndex(value: number, slotCount: number) {
  const integer = Number.isFinite(value) ? Math.floor(value) : 0;
  return ((integer % slotCount) + slotCount) % slotCount;
}

function normalizeSlot(value: unknown, index: number): LuckyWheelSlot {
  const slot = isRecord(value) ? value : {};
  const fallback = defaultLuckyWheelConfig.slots[index]?.label || `Ô ${index + 1}`;
  const label =
    typeof slot.label === "string" && slot.label.trim() ? slot.label.trim().slice(0, 60) : fallback;
  const type =
    slot.type === "no_prize" || (slot.type !== "reward" && /may mắn|không trúng/i.test(label))
      ? "no_prize"
      : "reward";

  return {
    label,
    active: Boolean(slot.active ?? true),
    type,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
