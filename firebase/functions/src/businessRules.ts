export type CustomerContactPatch = {
  phone?: string | null;
  phoneLast4?: string | null;
  birthday?: string | null;
};

export type WheelSlotInput = {
  label: string;
  active: boolean;
  type?: "reward" | "no_prize";
};

export function isVerifiedOwnerIdentity(input: { email?: unknown; emailVerified?: unknown }) {
  return (
    typeof input.email === "string" && input.email.trim().length > 0 && input.emailVerified === true
  );
}

export function buildCustomerContactPatch(input: {
  phone?: string;
  birthday?: string;
  clearPhone?: boolean;
  clearBirthday?: boolean;
}): CustomerContactPatch {
  const patch: CustomerContactPatch = {};
  const phone = input.phone?.trim();
  const birthday = input.birthday?.trim();

  if (input.clearPhone) {
    patch.phone = null;
    patch.phoneLast4 = null;
  } else if (phone) {
    patch.phone = phone;
    patch.phoneLast4 = phone.replace(/\D/g, "").slice(-4) || null;
  }

  if (input.clearBirthday) {
    patch.birthday = null;
  } else if (birthday) {
    patch.birthday = birthday;
  }

  return patch;
}

export function serviceSessionExpiresAtMs(createdAtMs: number, maxAgeMs: number) {
  return createdAtMs + maxAgeMs;
}

export function isServiceSessionExpired(expiresAtMs: number | null, nowMs: number) {
  return expiresAtMs !== null && expiresAtMs <= nowMs;
}

export function canCancelServiceSession(input: {
  userId: string;
  role: "owner" | "staff";
  assignedBranchIds: string[];
  branchId: string;
  status: unknown;
  assignedStaffId?: unknown;
}) {
  const status = String(input.status || "");
  if (!input.branchId || !["waiting", "serving", "pending_approval"].includes(status)) {
    return false;
  }
  if (input.role === "owner") {
    return true;
  }
  if (!input.assignedBranchIds.includes(input.branchId)) {
    return false;
  }
  if (status === "waiting") {
    return true;
  }
  return status === "serving" && input.assignedStaffId === input.userId;
}

export function normalizeWheelSlotType(type: unknown, label: string): "reward" | "no_prize" {
  if (type === "no_prize") {
    return "no_prize";
  }
  if (type === "reward") {
    return "reward";
  }
  return /may mắn|không trúng/i.test(label) ? "no_prize" : "reward";
}

export function selectWheelSlot(slots: WheelSlotInput[], randomValue: number) {
  const activeSlots = slots
    .map((slot) => ({
      ...slot,
      type: normalizeWheelSlotType(slot.type, slot.label),
    }))
    .filter((slot) => slot.active && slot.label.trim().length > 0);

  if (activeSlots.length === 0) {
    return null;
  }

  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999)
    : 0;
  const index = Math.floor(normalizedRandom * activeSlots.length);
  return { ...activeSlots[index], index };
}

export function randomUnitIntervalFromBytes(bytes: Uint8Array) {
  if (bytes.length !== 6) {
    throw new Error("Wheel entropy must contain exactly 6 bytes");
  }

  let value = 0;
  for (const byte of bytes) {
    value = value * 256 + byte;
  }
  return value / 2 ** 48;
}

export function wheelRewardOutcome(type: "reward" | "no_prize", generatedCode: string) {
  const isWinning = type === "reward";
  return {
    isWinning,
    rewardCode: isWinning ? generatedCode : null,
    status: isWinning ? ("unused" as const) : ("no_prize" as const),
  };
}

export function rewardExpiresAtMs(createdAtMs: number, validityDays: number) {
  const safeDays = Math.min(Math.max(Math.floor(validityDays), 1), 365);
  return createdAtMs + safeDays * 24 * 60 * 60 * 1000;
}

export function effectiveRewardStatus(
  status: unknown,
  expiresAtMs: number | null,
  nowMs: number,
): "unused" | "used" | "expired" | "revoked" | "no_prize" {
  if (status === "used" || status === "expired" || status === "revoked" || status === "no_prize") {
    return status;
  }
  return expiresAtMs !== null && expiresAtMs <= nowMs ? "expired" : "unused";
}

export function canCreateCustomerWithinPlan(input: {
  plan: unknown;
  customerCount: number;
  freeCustomerLimit: number;
}) {
  return input.plan !== "free" || input.customerCount < input.freeCustomerLimit;
}

export function canRestoreReward(input: {
  status: unknown;
  usedAtMs: number | null;
  expiresAtMs: number | null;
  nowMs: number;
  restoreWindowMs: number;
}) {
  return (
    input.status === "used" &&
    input.usedAtMs !== null &&
    input.usedAtMs <= input.nowMs &&
    input.nowMs - input.usedAtMs <= input.restoreWindowMs &&
    (input.expiresAtMs === null || input.expiresAtMs > input.nowMs)
  );
}

export function countUniqueCustomersSince(
  records: Array<{ customerId?: unknown; createdAtMs: number | null }>,
  sinceMs: number,
) {
  return new Set(
    records
      .filter((record) => record.createdAtMs !== null && record.createdAtMs >= sinceMs)
      .map((record) => record.customerId)
      .filter((customerId): customerId is string =>
        Boolean(typeof customerId === "string" && customerId.length > 0),
      ),
  ).size;
}

export function legacyBranchPatch(input: {
  currentBranchId: unknown;
  defaultBranchId: string;
  defaultBranchName: string;
}) {
  return typeof input.currentBranchId === "string" && input.currentBranchId.trim()
    ? null
    : {
        branchId: input.defaultBranchId,
        branchName: input.defaultBranchName,
        branchAddress: "",
      };
}

export function deletionJobOutcome(input: {
  remainingDocuments: number;
  remainingStorageFiles: number;
  failedStorageFiles: number;
  operationFailed: boolean;
}): "completed" | "partial" {
  return input.remainingDocuments === 0 &&
    input.remainingStorageFiles === 0 &&
    input.failedStorageFiles === 0 &&
    !input.operationFailed
    ? "completed"
    : "partial";
}
