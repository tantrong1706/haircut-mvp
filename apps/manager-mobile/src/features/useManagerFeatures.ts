import { DEFAULT_SYSTEM_FEATURES, type SystemFeatures } from "@haircut/contracts";
import type { SalonProfile } from "../services/managerApi";

export type ManagerFeatureKey =
  | "luckyWheelEnabled"
  | "rewardRedeemEnabled"
  | "photoUploadEnabled"
  | "pointApprovalEnabled"
  | "maintenanceMode";

export function useManagerFeatures(profile: SalonProfile | null) {
  const loaded = Boolean(profile);
  const features: SystemFeatures = profile?.features ?? { ...DEFAULT_SYSTEM_FEATURES };
  return {
    loaded,
    features,
    isEnabled: (key: ManagerFeatureKey) => loaded && features[key] === true,
  };
}
