"use strict";

const { z } = require("zod");

const AppRoleSchema = z.enum(["owner", "staff", "system_admin"]);
const SalonStatusSchema = z.enum(["active", "suspended", "pending_deletion"]);
const SessionStatusSchema = z.enum([
  "waiting",
  "serving",
  "pending_approval",
  "completed",
  "cancelled",
]);
const PointRequestStatusSchema = z.enum(["pending", "approved", "rejected"]);
const RewardStatusSchema = z.enum(["unused", "used", "expired", "revoked", "no_prize"]);

const CloudFunctionNames = Object.freeze([
  "createSalon",
  "createStaffProfile",
  "listBranches",
  "createBranch",
  "updateBranch",
  "rotateSalonQr",
  "rotateBranchQr",
  "migrateSalonBranches",
  "updateStaffProfile",
  "updateOwnerAvatar",
  "updateSalonAvatar",
  "getSalonProfile",
  "updateSalonProfile",
  "listStaffProfiles",
  "createManualCustomer",
  "resolveCustomerQr",
  "registerCustomerFromZalo",
  "submitPointRequest",
  "updatePendingPointRequestPhotos",
  "claimServiceSession",
  "cancelServiceSession",
  "approvePointRequest",
  "rejectPointRequest",
  "getOwnerOverview",
  "updateLuckyWheel",
  "spinLuckyWheel",
  "spinLuckyWheelFromZalo",
  "getCustomerSessionFromZalo",
  "getCustomerHistoryFromZalo",
  "getCustomerRewardsFromZalo",
  "searchSalonCustomers",
  "deleteCustomerData",
  "lookupRewardCode",
  "redeemRewardCode",
  "restoreRewardCode",
  "requestPersonalAccountDeletion",
  "requestSalonDeletion",
  "cancelSalonDeletion",
  "getSalonDeletionStatus",
  "registerManagerDeviceToken",
  "unregisterManagerDeviceToken",
  "getSystemAdminOverview",
  "listSystemAdminSalons",
  "updateSystemAdminSalonStatus",
  "updateSystemFeatureFlags",
  "getSystemFeatureFlags",
  "updateSystemAdminUserStatus",
  "cancelSessionAsSystemAdmin",
  "listSystemAdminAuditEvents",
]);
const CloudFunctionNameSchema = z.enum(CloudFunctionNames);

const ApiErrorCode = Object.freeze({
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  USER_INACTIVE: "USER_INACTIVE",
  SALON_SUSPENDED: "SALON_SUSPENDED",
  SALON_PENDING_DELETION: "SALON_PENDING_DELETION",
  INVALID_SALON: "INVALID_SALON",
  INVALID_BRANCH: "INVALID_BRANCH",
  BRANCH_ACCESS_DENIED: "BRANCH_ACCESS_DENIED",
  SESSION_ALREADY_CLAIMED: "SESSION_ALREADY_CLAIMED",
  SESSION_NOT_OPEN: "SESSION_NOT_OPEN",
  REQUEST_ALREADY_PROCESSED: "REQUEST_ALREADY_PROCESSED",
  STALE_WHEEL_CONFIG: "STALE_WHEEL_CONFIG",
  REWARD_ALREADY_REDEEMED: "REWARD_ALREADY_REDEEMED",
  REWARD_EXPIRED: "REWARD_EXPIRED",
  INVALID_REQUEST: "INVALID_REQUEST",
  APP_VERSION_UNSUPPORTED: "APP_VERSION_UNSUPPORTED",
  RATE_LIMITED: "RATE_LIMITED",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
  ADMIN_WRITE_DISABLED: "ADMIN_WRITE_DISABLED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});
const ApiErrorCodeSchema = z.enum(Object.values(ApiErrorCode));

const SystemFeaturesSchema = z.object({
  checkinEnabled: z.boolean(),
  luckyWheelEnabled: z.boolean(),
  rewardRedeemEnabled: z.boolean(),
  photoUploadEnabled: z.boolean(),
  pointApprovalEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  minimumSupportedAppVersion: z.string().trim().max(32),
  recommendedAppVersion: z.string().trim().max(32),
});

const DEFAULT_SYSTEM_FEATURES = Object.freeze({
  checkinEnabled: true,
  luckyWheelEnabled: true,
  rewardRedeemEnabled: true,
  photoUploadEnabled: true,
  pointApprovalEnabled: true,
  maintenanceMode: false,
  minimumSupportedAppVersion: "",
  recommendedAppVersion: "",
});

const PublicSalonProfileSchema = z.object({
  salonId: z.string().trim().min(1).max(128),
  salonName: z.string().trim().min(1).max(120),
  salonAvatarUrl: z.string().trim(),
});

const CustomerQrBranchSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(30),
  isActive: z.boolean(),
});

const CustomerQrResolutionSchema = PublicSalonProfileSchema.extend({
  qrType: z.enum(["salon", "branch", "legacy-mirror"]),
  branchId: z.string().trim().min(1).max(128).nullable(),
  branchName: z.string().trim().max(120),
  branchAddress: z.string().trim().max(300),
  selectionRequired: z.boolean(),
  branches: z.array(CustomerQrBranchSchema),
  features: SystemFeaturesSchema,
});

const DeviceTokenSchema = z.object({
  uid: z.string().trim().min(1).max(128),
  salonId: z.string().trim().min(1).max(128),
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(16).max(4096),
  appVersion: z.string().trim().max(32),
  isActive: z.boolean(),
});

function normalizeSystemFeatures(...sources) {
  const merged = Object.assign({}, DEFAULT_SYSTEM_FEATURES, ...sources.filter(Boolean));
  const parsed = SystemFeaturesSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...DEFAULT_SYSTEM_FEATURES };
}

module.exports = {
  ApiErrorCode,
  ApiErrorCodeSchema,
  AppRoleSchema,
  CloudFunctionNames,
  CloudFunctionNameSchema,
  CustomerQrBranchSchema,
  CustomerQrResolutionSchema,
  DEFAULT_SYSTEM_FEATURES,
  DeviceTokenSchema,
  PointRequestStatusSchema,
  PublicSalonProfileSchema,
  RewardStatusSchema,
  SalonStatusSchema,
  SessionStatusSchema,
  SystemFeaturesSchema,
  normalizeSystemFeatures,
};
