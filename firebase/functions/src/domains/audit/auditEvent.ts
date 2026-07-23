import { randomBytes } from "node:crypto";
import type { AppRole } from "@haircut/contracts";
import { Timestamp } from "firebase-admin/firestore";

type AuditActorRole = AppRole | "customer" | "system";

export function auditEventData(input: {
  salonId: string;
  branchId?: string | null;
  actorId: string;
  actorRole?: AuditActorRole | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId?: string;
  metadata?: Record<string, unknown> | null;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt?: Timestamp;
}) {
  const requestId = input.requestId || randomBytes(12).toString("hex");
  return {
    salonId: input.salonId,
    branchId: input.branchId ?? null,
    actorUid: input.actorId,
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    requestId,
    correlationId: requestId,
    metadata: input.metadata ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: input.createdAt ?? Timestamp.now(),
  };
}
