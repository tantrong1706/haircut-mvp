import {
  cancelFullSalonDeletion as sharedCancelFullSalonDeletion,
  deletePersonalAccount as sharedDeletePersonalAccount,
  getFullSalonDeletionStatus as sharedGetFullSalonDeletionStatus,
  requestFullSalonDeletion as sharedRequestFullSalonDeletion,
} from "../../../../../customer-web/src/services/accountDeletion";

export type {
  SalonDeletionStatus,
} from "../../../../../customer-web/src/services/accountDeletion";

export const cancelFullSalonDeletion = sharedCancelFullSalonDeletion;
export const deletePersonalAccount = sharedDeletePersonalAccount;
export const getFullSalonDeletionStatus = sharedGetFullSalonDeletionStatus;
export const requestFullSalonDeletion = sharedRequestFullSalonDeletion;
