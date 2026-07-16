import type { SalonStatus, SystemFeatures } from "@haircut/contracts";
import { callAdminFunction } from "./firebase";

export type AdminOverview = {
  salons: { total: number; active: number; suspended: number; pendingDeletion: number };
  users: { owners: number; staff: number };
  operations: { pendingPointRequests: number; openSessions: number };
};

export type AdminSalon = {
  id: string;
  name: string;
  status: SalonStatus;
  plan: string;
  customerCount: number;
  ownerId: string;
  updatedAtMs: number | null;
};

export type AdminAuditEvent = {
  id: string;
  salonId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAtMs: number | null;
};

export const adminApi = {
  overview: () =>
    callAdminFunction<Record<string, never>, AdminOverview>("getSystemAdminOverview", {}),
  salons: (cursor?: string) =>
    callAdminFunction<
      { cursor?: string; pageSize: number },
      { salons: AdminSalon[]; nextCursor: string | null }
    >("listSystemAdminSalons", { cursor, pageSize: 50 }),
  features: (salonId?: string) =>
    callAdminFunction<{ salonId?: string }, { salonId: string | null; features: SystemFeatures }>(
      "getSystemFeatureFlags",
      { salonId },
    ),
  auditEvents: (salonId?: string) =>
    callAdminFunction<{ salonId?: string; pageSize: number }, { events: AdminAuditEvent[] }>(
      "listSystemAdminAuditEvents",
      { salonId, pageSize: 50 },
    ),
};
