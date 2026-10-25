import { callFunction } from "./firebase";
export type LatestHaircutDetails = {
  recordId: string;
  sessionId: string;
  branchId: string;
  createdAtMs: number | null;
  revision: number;
  note: string;
  allowPhoto: boolean;
  photoConsentGranted: boolean;
  photoCount: number;
  photoUrls: string[];
};
export const getLatestHaircutDetails = (input: { salonId: string; customerId: string }) =>
  callFunction<typeof input, LatestHaircutDetails>("getLatestHaircutDetails", input);
export const updateLatestHaircutDetails = (input: {
  salonId: string;
  customerId: string;
  recordId: string;
  revision: number;
  note?: string;
  addPhotoPaths?: string[];
  photoConsentConfirmed?: true;
}) => callFunction<typeof input, { revision: number }>("updateLatestHaircutDetails", input);
