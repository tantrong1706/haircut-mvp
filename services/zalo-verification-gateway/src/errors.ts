export type GatewayErrorCode =
  | "AUTH_INVALID"
  | "REPLAY_DETECTED"
  | "REQUEST_EXPIRED"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "ZALO_INVALID_TOKEN"
  | "ZALO_TIMEOUT"
  | "ZALO_RATE_LIMITED"
  | "ZALO_UNAVAILABLE"
  | "ZALO_INVALID_RESPONSE"
  | "INTERNAL_ERROR";

export class GatewayError extends Error {
  constructor(
    readonly code: GatewayErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "GatewayError";
  }
}

export function toGatewayError(error: unknown): GatewayError {
  return error instanceof GatewayError ? error : new GatewayError("INTERNAL_ERROR", 500);
}
