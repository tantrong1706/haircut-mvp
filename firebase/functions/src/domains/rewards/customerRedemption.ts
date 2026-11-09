import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  effectiveRewardStatus,
  normalizeAllowedBranchIds,
  normalizeRedemptionScope,
  rewardLookupReason,
} from "../../businessRules";

export function requireRewardDocumentId(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Thông tin khách hoặc quà không hợp lệ.");
  }
  return value;
}

export function parseRewardCustomerIdentity(
  input: { customerId?: unknown; phoneLast4?: unknown } | undefined,
) {
  const customerId = requireRewardDocumentId(input?.customerId);
  if (typeof input?.phoneLast4 !== "string" || !/^\d{4}$/.test(input.phoneLast4)) {
    throw new HttpsError("invalid-argument", "Nhập đủ 4 số cuối điện thoại của khách.");
  }
  return { customerId, phoneLast4: input.phoneLast4 };
}

export function assertRewardCustomerPhone(customer: DocumentData | undefined, phoneLast4: string) {
  if (customer?.phoneLast4 !== phoneLast4) {
    throw new HttpsError("permission-denied", "4 số cuối không khớp khách đã chọn.");
  }
}

export function redeemableCustomerGift(
  id: string,
  reward: DocumentData,
  salonId: string,
  branchId: string,
  nowMs: number,
) {
  const expiresAtMs = reward.expiresAt instanceof Timestamp ? reward.expiresAt.toMillis() : null;
  if (
    rewardLookupReason({
      found: true,
      requestSalonId: salonId,
      rewardSalonId: String(reward.salonId || ""),
      branchId,
      branchSalonId: salonId,
      branchActive: true,
      status: effectiveRewardStatus(reward.status, expiresAtMs, nowMs),
      redemptionScope: normalizeRedemptionScope(reward.redemptionScope),
      allowedBranchIds: normalizeAllowedBranchIds(reward.allowedBranchIds),
    }) !== "OK"
  )
    return [];
  return [{ id, rewardName: String(reward.rewardName || "Quà"), expiresAtMs }];
}
