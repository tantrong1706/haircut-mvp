import {
  completeOwnerSalonProfile as sharedCompleteOwnerSalonProfile,
  getAppUser as sharedGetAppUser,
  isValidAuthEmail as sharedIsValidAuthEmail,
  listenAuthState as sharedListenAuthState,
  registerOwnerSalon as sharedRegisterOwnerSalon,
  requestOwnerStaffPasswordReset as sharedRequestOwnerStaffPasswordReset,
  signInOwnerStaff as sharedSignInOwnerStaff,
  signOutOwnerStaff as sharedSignOutOwnerStaff,
  updateOwnerAvatar as sharedUpdateOwnerAvatar,
  uploadOwnerAvatarFile as sharedUploadOwnerAvatarFile,
} from "../../../../../zalo-mini-app/src/services/auth";

export type {
  AppRole,
  AppUser,
} from "../../../../../zalo-mini-app/src/services/auth";

export const completeOwnerSalonProfile = sharedCompleteOwnerSalonProfile;
export const getAppUser = sharedGetAppUser;
export const isValidAuthEmail = sharedIsValidAuthEmail;
export const listenAuthState = sharedListenAuthState;
export const registerOwnerSalon = sharedRegisterOwnerSalon;
export const requestOwnerStaffPasswordReset = sharedRequestOwnerStaffPasswordReset;
export const signInOwnerStaff = sharedSignInOwnerStaff;
export const signOutOwnerStaff = sharedSignOutOwnerStaff;
export const updateOwnerAvatar = sharedUpdateOwnerAvatar;
export const uploadOwnerAvatarFile = sharedUploadOwnerAvatarFile;
