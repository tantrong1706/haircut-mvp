import { LuckyWheelConfig, LuckyWheelSlot, defaultLuckyWheelConfig } from "./types";

export function normalizeLuckyWheelConfig(value: unknown): LuckyWheelConfig {
  const source = isRecord(value) ? value : {};
  const rawSlots = Array.isArray(source.slots) ? source.slots : defaultLuckyWheelConfig.slots;
  const slots = rawSlots.slice(0, 6).map((slot, index) => normalizeSlot(slot, index));

  while (slots.length < 6) {
    slots.push(defaultLuckyWheelConfig.slots[slots.length]);
  }

  return {
    requiredPoints: Math.max(1, Number(source.requiredPoints ?? 5)),
    deductPointsAfterSpin: Boolean(source.deductPointsAfterSpin ?? true),
    slots,
  };
}

export function activeWheelSlots(config: LuckyWheelConfig): LuckyWheelSlot[] {
  return config.slots.filter((slot) => slot.active && slot.label.trim().length > 0);
}

function normalizeSlot(value: unknown, index: number): LuckyWheelSlot {
  const slot = isRecord(value) ? value : {};
  const fallback = defaultLuckyWheelConfig.slots[index]?.label || `Ô ${index + 1}`;
  const label = typeof slot.label === "string" && slot.label.trim() ? slot.label.trim() : fallback;

  return {
    label,
    active: Boolean(slot.active ?? true),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
