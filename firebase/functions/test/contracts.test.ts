import {
  ApiErrorCode,
  CloudFunctionNameSchema,
  RewardStatusSchema,
  normalizeSystemFeatures,
} from "@haircut/contracts";
import { describe, expect, it } from "vitest";

describe("contracts dùng chung", () => {
  it("công bố các mã lỗi tenant và idempotency ổn định", () => {
    expect(ApiErrorCode).toMatchObject({
      USER_INACTIVE: "USER_INACTIVE",
      INVALID_SALON: "INVALID_SALON",
      BRANCH_ACCESS_DENIED: "BRANCH_ACCESS_DENIED",
      SESSION_ALREADY_CLAIMED: "SESSION_ALREADY_CLAIMED",
      REQUEST_ALREADY_PROCESSED: "REQUEST_ALREADY_PROCESSED",
      REWARD_ALREADY_REDEEMED: "REWARD_ALREADY_REDEEMED",
    });
  });

  it("kiểm tra tên callable và trạng thái mã quà", () => {
    expect(CloudFunctionNameSchema.parse("claimServiceSession")).toBe("claimServiceSession");
    expect(CloudFunctionNameSchema.safeParse("unknownCallable").success).toBe(false);
    expect(RewardStatusSchema.parse("revoked")).toBe("revoked");
    expect(RewardStatusSchema.parse("no_prize")).toBe("no_prize");
  });

  it("feature flags thiếu trường luôn nhận mặc định an toàn", () => {
    expect(normalizeSystemFeatures({ maintenanceMode: true })).toMatchObject({
      maintenanceMode: true,
      checkinEnabled: true,
      pointApprovalEnabled: true,
    });
  });
});
