import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Conservative transport-peer quota. Behind a proxy this can group clients.
 * Neither forwarded headers nor Express `ip` are a trusted client identity.
 * Unknown peers share a bucket rather than getting a caller-controlled one.
 */
export function publicRequestPeer(request: { socket?: { remoteAddress?: unknown } }): string {
  const value = typeof request.socket?.remoteAddress === "string" ? request.socket.remoteAddress.trim() : "";
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return "unidentified-transport-peer";
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (canonical.startsWith("::ffff:")) {
    const words = canonical.slice(7).split(":").map((word) => Number.parseInt(word, 16));
    if (words.length === 2) return words.flatMap((word) => [word >> 8, word & 255]).join(".");
  }
  return canonical;
}

export type MirrorQrRecord = {
  salonId?: unknown;
  qrToken?: unknown;
  isActive?: unknown;
};

export type SignedQrKind = "salon" | "branch";

export type SignedQrInput = {
  kind: SignedQrKind;
  salonId: string;
  branchId?: string;
  version: number;
};

export type BranchAccessUser = {
  role?: unknown;
  branchId?: unknown;
  branchIds?: unknown;
};

export type BranchSelection =
  | { mode: "none"; branchId: null }
  | { mode: "selected"; branchId: string }
  | { mode: "choose"; branchId: null }
  | { mode: "invalid"; branchId: null };

export function isValidMirrorQr(
  mirror: MirrorQrRecord | undefined,
  salonId: string,
  qrToken: string,
) {
  return Boolean(
    mirror && mirror.salonId === salonId && mirror.qrToken === qrToken && mirror.isActive === true,
  );
}

export function defaultBranchIdForSalon(salonId: string) {
  return createHash("sha256").update(`default-branch:${salonId}`).digest("hex").slice(0, 40);
}

export function planDefaultBranchMigration(salonId: string, existingBranchIds: string[]) {
  const branchId = defaultBranchIdForSalon(salonId);
  return {
    branchId,
    shouldCreate: !existingBranchIds.includes(branchId),
  };
}

export function createSignedQrToken(secret: string, input: SignedQrInput) {
  if (secret.length < 32) {
    throw new Error("QR_SIGNING_SECRET phải có ít nhất 32 ký tự");
  }

  return createHmac("sha256", secret).update(signedQrPayload(input)).digest("base64url");
}

export function isValidSignedQrToken(secret: string, input: SignedQrInput, token: string) {
  if (!token || secret.length < 32) {
    return false;
  }

  const expected = Buffer.from(createSignedQrToken(secret, input));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function selectQrBranch(
  branches: Array<{ id: string; isActive: boolean }>,
  requestedBranchId?: string,
): BranchSelection {
  const active = branches.filter((branch) => branch.isActive);

  if (requestedBranchId) {
    return active.some((branch) => branch.id === requestedBranchId)
      ? { mode: "selected", branchId: requestedBranchId }
      : { mode: "invalid", branchId: null };
  }
  if (active.length === 0) {
    return { mode: "none", branchId: null };
  }
  if (active.length === 1) {
    return { mode: "selected", branchId: active[0].id };
  }
  return { mode: "choose", branchId: null };
}

export function canUserAccessBranch(user: BranchAccessUser, branchId: string) {
  if (user.role === "owner") {
    return true;
  }
  if (user.role !== "staff") {
    return false;
  }

  const branchIds = Array.isArray(user.branchIds)
    ? user.branchIds.filter((value): value is string => typeof value === "string")
    : [];
  return branchIds.includes(branchId) || user.branchId === branchId;
}

export function shouldReuseActiveSession(input: {
  status: unknown;
  sessionId: unknown;
  createdAtMs: number | null;
  expiresAtMs?: number | null;
  nowMs: number;
  maxAgeMs: number;
}) {
  const expiresAtMs =
    input.expiresAtMs ?? (input.createdAtMs === null ? null : input.createdAtMs + input.maxAgeMs);
  return Boolean(
    ["waiting", "serving", "pending_approval"].includes(String(input.status)) &&
    typeof input.sessionId === "string" &&
    input.sessionId.length > 0 &&
    input.createdAtMs !== null &&
    expiresAtMs !== null &&
    expiresAtMs > input.nowMs &&
    input.createdAtMs <= input.nowMs + 5 * 60 * 1000 &&
    input.nowMs - input.createdAtMs <= input.maxAgeMs,
  );
}

function signedQrPayload(input: SignedQrInput) {
  const branchId = input.kind === "branch" ? input.branchId || "" : "";
  return ["haircut-qr-v1", input.kind, input.salonId, branchId, input.version].join("|");
}
