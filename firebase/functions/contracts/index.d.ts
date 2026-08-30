export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: unknown };

export type RuntimeSchema<T> = {
  parse(value: unknown): T;
  safeParse(value: unknown): SafeParseResult<T>;
};

export type AppRole = "owner" | "staff" | "system_admin";
export declare const AppRoleSchema: RuntimeSchema<AppRole>;

export type SalonStatus = "active" | "suspended" | "pending_deletion";
export declare const SalonStatusSchema: RuntimeSchema<SalonStatus>;

export type SessionStatus =
  | "waiting"
  | "serving"
  | "pending_approval"
  | "completed"
  | "cancelled";
export declare const SessionStatusSchema: RuntimeSchema<SessionStatus>;

export type PointRequestStatus = "pending" | "approved" | "rejected";
export declare const PointRequestStatusSchema: RuntimeSchema<PointRequestStatus>;

export type RewardStatus = "unused" | "used" | "expired" | "revoked" | "no_prize";
export declare const RewardStatusSchema: RuntimeSchema<RewardStatus>;

export declare const CloudFunctionNames: readonly string[];
export type CloudFunctionName = (typeof CloudFunctionNames)[number];
export declare const CloudFunctionNameSchema: RuntimeSchema<CloudFunctionName>;

export declare const ApiErrorCode: Readonly<{
  UNAUTHENTICATED: "UNAUTHENTICATED";
  FORBIDDEN: "FORBIDDEN";
  USER_INACTIVE: "USER_INACTIVE";
  SALON_SUSPENDED: "SALON_SUSPENDED";
  SALON_PENDING_DELETION: "SALON_PENDING_DELETION";
  INVALID_SALON: "INVALID_SALON";
  INVALID_BRANCH: "INVALID_BRANCH";
  BRANCH_ACCESS_DENIED: "BRANCH_ACCESS_DENIED";
  SESSION_ALREADY_CLAIMED: "SESSION_ALREADY_CLAIMED";
  SESSION_NOT_OPEN: "SESSION_NOT_OPEN";
  REQUEST_ALREADY_PROCESSED: "REQUEST_ALREADY_PROCESSED";
  STALE_WHEEL_CONFIG: "STALE_WHEEL_CONFIG";
  REWARD_ALREADY_REDEEMED: "REWARD_ALREADY_REDEEMED";
  REWARD_EXPIRED: "REWARD_EXPIRED";
  INVALID_REQUEST: "INVALID_REQUEST";
  APP_VERSION_UNSUPPORTED: "APP_VERSION_UNSUPPORTED";
  RATE_LIMITED: "RATE_LIMITED";
  FEATURE_DISABLED: "FEATURE_DISABLED";
  MAINTENANCE_MODE: "MAINTENANCE_MODE";
  ADMIN_WRITE_DISABLED: "ADMIN_WRITE_DISABLED";
  INTERNAL_ERROR: "INTERNAL_ERROR";
}>;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
export declare const ApiErrorCodeSchema: RuntimeSchema<ApiErrorCode>;

export type SystemFeatures = {
  checkinEnabled: boolean;
  luckyWheelEnabled: boolean;
  rewardRedeemEnabled: boolean;
  photoUploadEnabled: boolean;
  pointApprovalEnabled: boolean;
  maintenanceMode: boolean;
  minimumSupportedAppVersion: string;
  recommendedAppVersion: string;
};
export declare const SystemFeaturesSchema: RuntimeSchema<SystemFeatures>;
export declare const DEFAULT_SYSTEM_FEATURES: Readonly<SystemFeatures>;

export type PublicSalonProfile = {
  salonId: string;
  salonName: string;
  salonAvatarUrl: string;
};
export declare const PublicSalonProfileSchema: RuntimeSchema<PublicSalonProfile>;

export type CustomerQrBranch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};
export declare const CustomerQrBranchSchema: RuntimeSchema<CustomerQrBranch>;

export type CustomerQrResolution = PublicSalonProfile & {
  qrType: "salon" | "branch" | "legacy-mirror";
  branchId: string | null;
  branchName: string;
  branchAddress: string;
  selectionRequired: boolean;
  branches: CustomerQrBranch[];
  features: SystemFeatures;
};
export declare const CustomerQrResolutionSchema: RuntimeSchema<CustomerQrResolution>;

export type DeviceToken = {
  uid: string;
  salonId: string;
  platform: "ios" | "android";
  token: string;
  appVersion: string;
  isActive: boolean;
};
export declare const DeviceTokenSchema: RuntimeSchema<DeviceToken>;

export declare function normalizeSystemFeatures(
  ...sources: Array<Partial<SystemFeatures> | null | undefined>
): SystemFeatures;
