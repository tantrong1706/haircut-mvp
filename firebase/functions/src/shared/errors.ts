import type { ApiErrorCode as ApiErrorCodeValue } from "@haircut/contracts";
import { HttpsError } from "firebase-functions/v2/https";

type FirebaseHttpsCode = ConstructorParameters<typeof HttpsError>[0];

export function apiError(
  code: FirebaseHttpsCode,
  errorCode: ApiErrorCodeValue,
  message: string,
  details: Record<string, unknown> = {},
) {
  return new HttpsError(code, message, { ...details, errorCode });
}
