import { callFunction } from "./firebase";

export type CustomerRewardIdentity = {
  salonId: string;
  branchId: string;
  customerId: string;
  phoneLast4: string;
};

export type RedeemableCustomerReward = {
  id: string;
  rewardName: string;
  expiresAtMs: number | null;
};

export type RedeemableCustomerRewardPage = {
  rewards: RedeemableCustomerReward[];
  nextCursor: string | null;
};

export function listRedeemableCustomerRewards(input: CustomerRewardIdentity & { cursor?: string }) {
  return callFunction<typeof input, RedeemableCustomerRewardPage>(
    "listRedeemableCustomerRewards",
    input,
  );
}

export function redeemCustomerReward(
  input: CustomerRewardIdentity & { rewardId: string; idempotencyKey: string },
) {
  return callFunction<typeof input, { rewardId: string; alreadyRedeemed: boolean }>(
    "redeemRewardCode",
    input,
  );
}
