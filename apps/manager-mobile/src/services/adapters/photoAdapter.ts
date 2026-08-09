import {
  MAX_HAIRCUT_PHOTOS as sharedMaxHaircutPhotos,
  deleteHaircutPhoto as sharedDeleteHaircutPhoto,
  recoverHaircutPhotoUploads as sharedRecoverHaircutPhotoUploads,
  uploadHaircutPhoto as sharedUploadHaircutPhoto,
} from "../../../../../zalo-mini-app/src/services/customerPhotos";
export {
  cameraPermissionMessage,
  inspectCameraPermission,
  type CameraPermissionState,
} from "../../../../../zalo-mini-app/src/services/cameraPermission";

export type {
  UploadedHaircutPhoto,
} from "../../../../../zalo-mini-app/src/services/customerPhotos";

export const MAX_HAIRCUT_PHOTOS = sharedMaxHaircutPhotos;
export const deleteHaircutPhoto = sharedDeleteHaircutPhoto;
export const recoverHaircutPhotoUploads = sharedRecoverHaircutPhotoUploads;
export const uploadHaircutPhoto = sharedUploadHaircutPhoto;
