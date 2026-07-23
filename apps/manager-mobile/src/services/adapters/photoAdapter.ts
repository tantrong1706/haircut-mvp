import {
  MAX_HAIRCUT_PHOTOS as sharedMaxHaircutPhotos,
  deleteHaircutPhoto as sharedDeleteHaircutPhoto,
  uploadHaircutPhoto as sharedUploadHaircutPhoto,
} from "../../../../../zalo-mini-app/src/services/customerPhotos";

export type {
  UploadedHaircutPhoto,
} from "../../../../../zalo-mini-app/src/services/customerPhotos";

export const MAX_HAIRCUT_PHOTOS = sharedMaxHaircutPhotos;
export const deleteHaircutPhoto = sharedDeleteHaircutPhoto;
export const uploadHaircutPhoto = sharedUploadHaircutPhoto;
