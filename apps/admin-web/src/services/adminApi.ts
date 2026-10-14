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

export type RepairAction = "reconcile_customer_count" | "clear_stale_session_pointer";
export type AdminDiagnostics = {
  salonId: string;
  salonName: string;
  status: SalonStatus;
  checkedAtMs: number;
  repairsEnabled: boolean;
  customerCount: { stored: number | null; actual: number };
  activeBranches: number;
  features: SystemFeatures;
  issues: Array<{
    code: string;
    severity: "warning" | "error";
    message: string;
    action: RepairAction | null;
  }>;
  stalePointers: Array<{ pointerId: string; sessionId: string; customerId: string }>;
  pointerScan: { checked: number; hasMore: boolean };
};
export type AdminRepairInput = {
  salonId: string;
  action: RepairAction;
  operationId: string;
  reason: string;
  confirmedSalonName: string;
  expectedStoredCount?: number | null;
  expectedActualCount?: number;
  pointerId?: string;
  expectedSessionId?: string;
};

export const adminApi = {
  access: () =>
    callAdminFunction<Record<string, never>, { authorized: boolean; repairsEnabled: boolean }>(
      "getSystemAdminAccess",
      {},
    ),
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
  diagnostics: (salonId: string) =>
    callAdminFunction<{ salonId: string }, AdminDiagnostics>("getSystemAdminSalonDiagnostics", {
      salonId,
    }),
  repair: (input: AdminRepairInput) =>
    callAdminFunction<
      AdminRepairInput,
      { changed: boolean; salonId: string; action: RepairAction; operationId: string }
    >("repairSystemAdminSalon", input),
};
