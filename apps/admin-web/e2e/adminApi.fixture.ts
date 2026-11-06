import type {
  AdminDiagnostics,
  AdminRepairInput,
  AdminSalon,
  AdminManagementInput,
  AdminSalonOperations,
} from "../src/services/adminApi";

const scenario = new URLSearchParams(location.search).get("scenario");
const features = {
  checkinEnabled: true,
  pointApprovalEnabled: true,
  photoUploadEnabled: true,
  luckyWheelEnabled: true,
  rewardRedeemEnabled: true,
  maintenanceMode: false,
  minimumSupportedAppVersion: "",
  recommendedAppVersion: "",
};
let stored = 99;
let managedStatus: "active" | "suspended" = "active";
let cancelled = false;
const salon = (id: string, name: string): AdminSalon => ({
  id,
  name,
  status: "active",
  plan: "free",
  customerCount: stored,
  ownerId: "fixture-owner",
  updatedAtMs: null,
});
const offline = () => {
  if (scenario === "offline") throw { code: "functions/unavailable" };
};
export const adminApi = {
  salonOperations: async (salonId: string): Promise<AdminSalonOperations> => {
    if (scenario === "queue-offline") throw { code: "functions/unavailable" };
    return {
      salonId,
      salonName: salonId === "salon-a" ? "Salon A" : "Salon B",
      status: managedStatus,
      checkedAtMs: Date.now(),
      writesEnabled: scenario !== "readonly",
      totalPending: cancelled ? 0 : 1,
      nextCursor: null,
      requests: cancelled
        ? []
        : [
            {
              id: "fixture-request-a",
              sessionId: "fixture-request-a",
              branchId: "fixture-branch",
              branchName: "Chi nhánh kiểm thử",
              state: "expired",
              cancellable: true,
              createdAtMs: 1000,
              expiresAtMs: 2000,
            },
          ],
    };
  },
  manageSalon: async (input: AdminManagementInput) => {
    if (
      scenario === "readonly" ||
      input.expectedStatus !== managedStatus ||
      input.confirmedSalonName !== "Salon A" ||
      input.reason.trim().length < 10 ||
      !input.operationId
    )
      throw new Error("Invalid fixture management");
    (
      window as typeof window & { lastFixtureManagement?: AdminManagementInput }
    ).lastFixtureManagement = input;
    if (input.action === "cancel_point_request") {
      if (input.requestId !== "fixture-request-a") throw new Error("Wrong fixture request");
      cancelled = true;
    } else managedStatus = input.action === "suspend_salon" ? "suspended" : "active";
    return { changed: true, operationId: input.operationId };
  },
  overview: async () => {
    offline();
    return {
      salons: { total: 2, active: 2, suspended: 0, pendingDeletion: 0 },
      users: { owners: 2, staff: 1 },
      operations: { pendingPointRequests: 0, openSessions: 0 },
    };
  },
  salons: async (cursor?: string) => {
    offline();
    return cursor
      ? { salons: [salon("salon-b", "Salon B")], nextCursor: null }
      : { salons: [salon("salon-a", "Salon A")], nextCursor: "page-b" };
  },
  features: async () => ({ features }),
  auditEvents: async () => ({ events: [] }),
  diagnostics: async (salonId: string): Promise<AdminDiagnostics> => ({
    salonId,
    salonName: salonId === "salon-a" ? "Salon A" : "Salon B",
    status: "active",
    checkedAtMs: Date.now(),
    repairsEnabled: scenario !== "readonly",
    customerCount: { stored, actual: 2 },
    activeBranches: 1,
    features,
    issues:
      stored === 2
        ? []
        : [
            {
              code: "CUSTOMER_COUNT_MISMATCH",
              severity: "warning",
              message: "Bộ đếm khách không khớp số hồ sơ thực tế.",
              action: "reconcile_customer_count",
            },
          ],
    stalePointers: [],
    pointerScan: { checked: 0, hasMore: false },
  }),
  repair: async (input: AdminRepairInput) => {
    if (
      scenario === "readonly" ||
      input.action !== "reconcile_customer_count" ||
      input.expectedStoredCount !== stored ||
      input.expectedActualCount !== 2 ||
      input.confirmedSalonName !== "Salon A"
    )
      throw new Error("Invalid fixture repair");
    (window as typeof window & { lastFixtureRepair?: AdminRepairInput }).lastFixtureRepair = input;
    stored = 2;
    return { changed: true };
  },
};
