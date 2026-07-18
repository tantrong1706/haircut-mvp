import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_FEATURES } from "@haircut/contracts";
import { useManagerFeatures } from "./useManagerFeatures";

describe("Manager feature flags", () => {
  it("không tuyên bố tính năng bật trước khi tải hồ sơ", () => {
    const result = useManagerFeatures(null);
    expect(result.loaded).toBe(false);
    expect(result.isEnabled("rewardRedeemEnabled")).toBe(false);
  });

  it("dùng đúng feature flags đã tải từ backend", () => {
    const result = useManagerFeatures({
      id: "salon",
      name: "HAIRCUT",
      address: "",
      phone: "",
      avatarUrl: "",
      pointPerVisit: 1,
      freeCustomerLimit: 50,
      features: {
        ...DEFAULT_SYSTEM_FEATURES,
        luckyWheelEnabled: false,
        photoUploadEnabled: false,
      },
    });
    expect(result.isEnabled("luckyWheelEnabled")).toBe(false);
    expect(result.isEnabled("photoUploadEnabled")).toBe(false);
    expect(result.isEnabled("pointApprovalEnabled")).toBe(true);
  });
});
