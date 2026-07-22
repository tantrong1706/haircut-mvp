import {
  approvePointRequest as sharedApprovePointRequest,
  cancelServiceSession as sharedCancelServiceSession,
  claimServiceSession as sharedClaimServiceSession,
  createBranch as sharedCreateBranch,
  createStaffProfile as sharedCreateStaffProfile,
  deleteCustomerData as sharedDeleteCustomerData,
  formatDateTime as sharedFormatDateTime,
  getBranchQrSettings as sharedGetBranchQrSettings,
  getLuckyWheelConfig as sharedGetLuckyWheelConfig,
  getManagerPointRequestHistory as sharedGetManagerPointRequestHistory,
  getManagerRewardHistory as sharedGetManagerRewardHistory,
  getManagerSessionHistory as sharedGetManagerSessionHistory,
  getOwnerOverview as sharedGetOwnerOverview,
  getSalonProfile as sharedGetSalonProfile,
  listenActiveSessions as sharedListenActiveSessions,
  listenPendingPointRequests as sharedListenPendingPointRequests,
  listenStaffProfiles as sharedListenStaffProfiles,
  lookupRewardCode as sharedLookupRewardCode,
  migrateSalonBranches as sharedMigrateSalonBranches,
  normalizePointRejectionReason as sharedNormalizePointRejectionReason,
  redeemRewardCode as sharedRedeemRewardCode,
  rejectPointRequest as sharedRejectPointRequest,
  restoreRewardCode as sharedRestoreRewardCode,
  rotateBranchQr as sharedRotateBranchQr,
  rotateSalonQr as sharedRotateSalonQr,
  saveLuckyWheelConfig as sharedSaveLuckyWheelConfig,
  searchSalonCustomers as sharedSearchSalonCustomers,
  sendStaffInviteEmail as sharedSendStaffInviteEmail,
  submitPointRequest as sharedSubmitPointRequest,
  updateBranch as sharedUpdateBranch,
  updatePendingPointRequestPhotos as sharedUpdatePendingPointRequestPhotos,
  updateSalonProfile as sharedUpdateSalonProfile,
  updateStaffProfile as sharedUpdateStaffProfile,
} from "../../../../../zalo-mini-app/src/services/operations";

export type {
  BranchQrSettings,
  CustomerLookupResult,
  DeleteCustomerDataResult,
  ManagerPointRequestHistoryItem,
  ManagerRewardHistoryItem,
  ManagerSessionHistoryItem,
  OwnerOverview,
  PointRequest,
  RedeemRewardResult,
  RewardCodeInfo,
  SalonBranch,
  SalonProfile,
  StaffProfile,
  StaffSession,
} from "../../../../../zalo-mini-app/src/services/operations";

export const approvePointRequest = sharedApprovePointRequest;
export const cancelServiceSession = sharedCancelServiceSession;
export const claimServiceSession = sharedClaimServiceSession;
export const createBranch = sharedCreateBranch;
export const createStaffProfile = sharedCreateStaffProfile;
export const deleteCustomerData = sharedDeleteCustomerData;
export const formatDateTime = sharedFormatDateTime;
export const getBranchQrSettings = sharedGetBranchQrSettings;
export const getLuckyWheelConfig = sharedGetLuckyWheelConfig;
export const getManagerPointRequestHistory = sharedGetManagerPointRequestHistory;
export const getManagerRewardHistory = sharedGetManagerRewardHistory;
export const getManagerSessionHistory = sharedGetManagerSessionHistory;
export const getOwnerOverview = sharedGetOwnerOverview;
export const getSalonProfile = sharedGetSalonProfile;
export const listenActiveSessions = sharedListenActiveSessions;
export const listenPendingPointRequests = sharedListenPendingPointRequests;
export const listenStaffProfiles = sharedListenStaffProfiles;
export const lookupRewardCode = sharedLookupRewardCode;
export const migrateSalonBranches = sharedMigrateSalonBranches;
export const normalizePointRejectionReason = sharedNormalizePointRejectionReason;
export const redeemRewardCode = sharedRedeemRewardCode;
export const rejectPointRequest = sharedRejectPointRequest;
export const restoreRewardCode = sharedRestoreRewardCode;
export const rotateBranchQr = sharedRotateBranchQr;
export const rotateSalonQr = sharedRotateSalonQr;
export const saveLuckyWheelConfig = sharedSaveLuckyWheelConfig;
export const searchSalonCustomers = sharedSearchSalonCustomers;
export const sendStaffInviteEmail = sharedSendStaffInviteEmail;
export const submitPointRequest = sharedSubmitPointRequest;
export const updateBranch = sharedUpdateBranch;
export const updatePendingPointRequestPhotos = sharedUpdatePendingPointRequestPhotos;
export const updateSalonProfile = sharedUpdateSalonProfile;
export const updateStaffProfile = sharedUpdateStaffProfile;
