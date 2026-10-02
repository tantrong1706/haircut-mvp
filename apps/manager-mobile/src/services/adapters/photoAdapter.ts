import {
  MAX_HAIRCUT_PHOTOS as sharedMaxHaircutPhotos,
  deleteHaircutPhoto as sharedDeleteHaircutPhoto,
  recoverHaircutPhotoUploads as sharedRecoverHaircutPhotoUploads,
  uploadHaircutPhoto as sharedUploadHaircutPhoto,
} from "../../../../../customer-web/src/services/customerPhotos";
export {
  cameraPermissionMessage,
  inspectCameraPermission,
  type CameraPermissionState,
} from "../../../../../customer-web/src/services/cameraPermission";

export type {
  UploadedHaircutPhoto,
} from "../../../../../customer-web/src/services/customerPhotos";

export const MAX_HAIRCUT_PHOTOS = sharedMaxHaircutPhotos;
export const deleteHaircutPhoto = sharedDeleteHaircutPhoto;
export const recoverHaircutPhotoUploads = sharedRecoverHaircutPhotoUploads;
export const uploadHaircutPhoto = sharedUploadHaircutPhoto;
