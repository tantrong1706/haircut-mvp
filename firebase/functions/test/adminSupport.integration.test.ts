import { createHash } from "node:crypto";
import { deleteApp, getApps } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as callables from "../src/index";
import { requireFirestoreEmulator } from "./emulatorEnvironment";

const { emulatorHost, projectId } = requireFirestoreEmulator();
const db = getFirestore();
const SALON = "support-salon-a";
const OTHER = "support-salon-b";
const ADMIN = "support-admin";
const pointerId = (customer = "customer-a") =>
  createHash("sha256").update(`${SALON}:${customer}`).digest("hex").slice(0, 40);
const auth = (uid: string) => ({ uid, token: { auth_time: Math.floor(Date.now() / 1000) } });

async function invoke(
  name: string,
  data: Record<string, unknown> = {},
  identity: unknown = auth(ADMIN),
) {
  const fn = (
    callables as unknown as Record<
      string,
      {
        run: (request: unknown) => Promise<Record<string, unknown>>;
      }
    >
  )[name];
  expect(fn, `Missing admin support endpoint: ${name}`).toBeDefined();
  return fn.run({ data, auth: identity, rawRequest: { ip: "127.0.0.1", get: () => undefined } });
}

const diagnose = (salonId = SALON) => invoke("getSystemAdminSalonDiagnostics", { salonId });
const repair = (patch: Record<string, unknown> = {}, identity: unknown = auth(ADMIN)) =>
  invoke(
    "repairSystemAdminSalon",
    {
      salonId: SALON,
      action: "reconcile_customer_count",
      expectedStoredCount: 99,
      expectedActualCount: 2,
      confirmedSalonName: "Salon Support A",
      reason: "Đối chiếu dữ liệu thực tế trong kiểm thử",
      operationId: "support-operation-0001",
      ...patch,
    },
    identity,
  );

beforeEach(async () => {
  vi.stubEnv("ADMIN_SUPPORT_REPAIRS_ENABLED", "true");
  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Cannot reset isolated emulator");
  const batch = db.batch();
  batch.set(db.doc(`users/${ADMIN}`), { role: "owner", salonId: SALON, isActive: true });
  batch.set(db.doc(`system_admin_access/${ADMIN}`), { isActive: true, role: "system_admin" });
  batch.set(db.doc("users/ordinary-owner"), { role: "owner", salonId: SALON, isActive: true });
  batch.set(db.doc(`salons/${SALON}`), {
    name: "Salon Support A",
    ownerId: ADMIN,
    isActive: true,
    status: "active",
    customerCount: 99,
  });
  batch.set(db.doc(`salons/${OTHER}`), {
    name: "Salon Support B",
    ownerId: "other-owner",
    isActive: true,
    customerCount: 1,
  });
  batch.set(db.doc("branches/branch-a"), { salonId: SALON, isActive: true });
  batch.set(db.doc("customers/customer-a"), {
    salonId: SALON,
    points: 7,
    phone: "PRIVATE_PHONE_FIXTURE",
    name: "PRIVATE_NAME_FIXTURE",
  });
  batch.set(db.doc("customers/customer-a2"), { salonId: SALON, points: 3 });
  batch.set(db.doc("customers/customer-b"), { salonId: OTHER, points: 50 });
  batch.set(db.doc("reward_history/reward-a"), { salonId: SALON, status: "unused" });
  await batch.commit();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

describe("admin support authorization", () => {
  it("grants separate admin access without replacing the salon-owner role", async () => {
    await expect(invoke("getSystemAdminAccess")).resolves.toMatchObject({
      authorized: true,
      repairsEnabled: true,
    });
    await expect(
      callables.getSystemAdminOverview.run({ auth: auth(ADMIN), data: {} } as never),
    ).resolves.toMatchObject({ salons: { total: 2 } });
    expect((await db.doc(`users/${ADMIN}`).get()).data()?.role).toBe("owner");
  });
  it("continues to accept the existing system_admin role", async () => {
    await db.doc("users/legacy-admin").set({ role: "system_admin", isActive: true });
    await expect(invoke("getSystemAdminAccess", {}, auth("legacy-admin"))).resolves.toMatchObject({
      authorized: true,
    });
  });
  it.each([undefined, auth("ordinary-owner"), auth("unknown-user")])(
    "rejects callers without admin authority %#",
    async (identity) => {
      await expect(
        invoke("getSystemAdminSalonDiagnostics", { salonId: SALON }, identity ?? null),
      ).rejects.toMatchObject({ code: identity ? "permission-denied" : "unauthenticated" });
    },
  );
  it("revokes access immediately when the separate grant is disabled", async () => {
    await db.doc(`system_admin_access/${ADMIN}`).update({ isActive: false });
    await expect(diagnose()).rejects.toMatchObject({ code: "permission-denied" });
    await expect(repair()).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("does not enable legacy admin mutations when narrow support repairs are enabled", async () => {
    vi.stubEnv("ADMIN_WRITE_OPERATIONS_ENABLED", "false");
    await expect(
      callables.updateSystemAdminSalonStatus.run({
        auth: auth(ADMIN),
        data: { salonId: SALON, status: "suspended", reason: "test" },
      } as never),
    ).rejects.toMatchObject({ details: { errorCode: "ADMIN_WRITE_DISABLED" } });
  });
});

describe("bounded salon diagnostics", () => {
  it("counts only the selected tenant and reports drift without leaking customer data", async () => {
    const result = await diagnose();
    expect(result).toMatchObject({ salonId: SALON, customerCount: { stored: 99, actual: 2 } });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CUSTOMER_COUNT_MISMATCH",
          action: "reconcile_customer_count",
        }),
      ]),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /PRIVATE_PHONE_FIXTURE|PRIVATE_NAME_FIXTURE|customer-b/,
    );
  });
  it("reports missing owner, no branch and maintenance as warnings, not auto-repair actions", async () => {
    await db.doc(`users/${ADMIN}`).delete();
    await db.doc("branches/branch-a").delete();
    await db.doc("system_config/features").set({ maintenanceMode: true });
    const result = await diagnose();
    for (const code of ["OWNER_UNAVAILABLE", "NO_ACTIVE_BRANCH", "MAINTENANCE_MODE"]) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code, action: null })]),
      );
    }
  });
  it("reports a stale closed-session pointer without exposing client tokens", async () => {
    await seedPointer("completed", false);
    const result = await diagnose();
    expect(result.stalePointers).toEqual([
      expect.objectContaining({ pointerId: pointerId(), sessionId: "session-a" }),
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_TOKEN_FIXTURE");
  });
  it("does not offer to remove a currently open session", async () => {
    await seedPointer("pending_approval", true);
    expect((await diagnose()).stalePointers).toEqual([]);
  });
  it("marks pointer diagnostics as partial when the bounded scan has more rows", async () => {
    const batch = db.batch();
    for (let i = 0; i < 51; i++)
      batch.set(db.doc(`active_service_sessions/${pointerId(`fixture-${i}`)}`), {
        salonId: SALON,
        customerId: `fixture-${i}`,
        sessionId: `missing-${i}`,
      });
    await batch.commit();
    expect((await diagnose()).pointerScan).toMatchObject({ checked: 50, hasMore: true });
  });
  it("rejects missing salons and path-like ids", async () => {
    await expect(diagnose("missing")).rejects.toMatchObject({ code: "not-found" });
    await expect(diagnose("a/b")).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("safe repair transactions", () => {
  it("reconciles the counter atomically, audits the reason, and does not alter points/rewards", async () => {
    await expect(repair()).resolves.toMatchObject({
      changed: true,
      action: "reconcile_customer_count",
      salonId: SALON,
    });
    expect((await db.doc(`salons/${SALON}`).get()).data()?.customerCount).toBe(2);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(7);
    expect((await db.doc("reward_history/reward-a").get()).data()?.status).toBe("unused");
    expect((await db.doc(`salons/${OTHER}`).get()).data()?.customerCount).toBe(1);
    const audit = await db
      .collection("audit_events")
      .where("action", "==", "admin.support.reconcile_customer_count")
      .get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data()).toMatchObject({
      actorId: ADMIN,
      actorRole: "system_admin",
      salonId: SALON,
      before: { customerCount: 99 },
      after: { customerCount: 2 },
    });
  });
  it("deduplicates simultaneous repeat submissions and rejects operation-id reuse", async () => {
    const results = await Promise.all([repair(), repair()]);
    expect(results).toHaveLength(2);
    expect((await db.collection("audit_events").get()).size).toBe(1);
    await expect(repair({ reason: "Khác nội dung của thao tác cũ" })).rejects.toMatchObject({
      code: "already-exists",
    });
  });
  it("rejects a stale preview instead of applying an outdated correction", async () => {
    await db.doc("customers/new-customer").set({ salonId: SALON, points: 0 });
    await expect(repair()).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "ADMIN_PREVIEW_STALE" },
    });
    expect((await db.doc(`salons/${SALON}`).get()).data()?.customerCount).toBe(99);
    expect((await db.collection("audit_events").get()).empty).toBe(true);
  });
  it("requires the dedicated repair switch even for an admin", async () => {
    vi.stubEnv("ADMIN_SUPPORT_REPAIRS_ENABLED", "false");
    expect((await invoke("getSystemAdminAccess")).repairsEnabled).toBe(false);
    await expect(repair()).rejects.toMatchObject({
      code: "failed-precondition",
      details: { errorCode: "ADMIN_SUPPORT_REPAIRS_DISABLED" },
    });
  });
  it.each([
    { action: "set_points" },
    { salonId: "a/b" },
    { reason: "" },
    { operationId: "short" },
    { expectedActualCount: -1 },
    { expectedStoredCount: "99" },
  ])("rejects unsupported or invalid repair inputs %#", async (patch) => {
    await expect(repair(patch)).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await db.collection("audit_events").get()).empty).toBe(true);
  });
  it("requires exact salon-name confirmation and recent authentication", async () => {
    await expect(repair({ confirmedSalonName: "Other Salon" })).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(repair({}, { uid: ADMIN, token: { auth_time: 1 } })).rejects.toMatchObject({
      details: { errorCode: "RECENT_LOGIN_REQUIRED" },
    });
  });
  it("refuses repairs while salon deletion is in progress", async () => {
    await db.doc(`salons/${SALON}`).update({ status: "pending_deletion" });
    await expect(repair()).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("removes only the confirmed stale pointer, leaving session and cooldown untouched", async () => {
    await seedPointer("completed", false);
    await db.doc("customers/customer-a").update({ lastPointAwardedAt: Timestamp.fromMillis(1000) });
    await expect(
      repair({
        action: "clear_stale_session_pointer",
        pointerId: pointerId(),
        expectedSessionId: "session-a",
      }),
    ).resolves.toMatchObject({ changed: true });
    expect((await db.doc(`active_service_sessions/${pointerId()}`).get()).exists).toBe(false);
    expect((await db.doc("chair_sessions/session-a").get()).data()?.status).toBe("completed");
    expect((await db.doc("customers/customer-a").get()).data()?.lastPointAwardedAt.toMillis()).toBe(
      1000,
    );
  });
  it("refuses a pointer that now refers to an active session", async () => {
    await seedPointer("serving", true);
    await expect(
      repair({
        action: "clear_stale_session_pointer",
        pointerId: pointerId(),
        expectedSessionId: "session-a",
      }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.doc(`active_service_sessions/${pointerId()}`).get()).exists).toBe(true);
  });
  it("refuses pointer/session tenant mismatch without changing either tenant", async () => {
    await seedPointer("completed", false);
    await db.doc("chair_sessions/session-a").update({ salonId: OTHER });
    await expect(
      repair({
        action: "clear_stale_session_pointer",
        pointerId: pointerId(),
        expectedSessionId: "session-a",
      }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.doc(`active_service_sessions/${pointerId()}`).get()).exists).toBe(true);
  });
});

async function seedPointer(status: string, isOpen: boolean) {
  await db.doc(`active_service_sessions/${pointerId()}`).set({
    salonId: SALON,
    customerId: "customer-a",
    sessionId: "session-a",
    privateToken: "PRIVATE_TOKEN_FIXTURE",
  });
  await db
    .doc("chair_sessions/session-a")
    .set({ salonId: SALON, customerId: "customer-a", status, isOpen });
}

async function seedPendingRequest(requestId = "queue-request-a", salonId = SALON) {
  const now = Timestamp.now();
  const data = {
    salonId,
    branchId: "branch-a",
    branchName: "Chi nhánh A",
    customerId: "customer-a",
    sessionId: requestId,
    status: "pending",
    approvalMode: "staff_confirmation",
    createdAt: now,
    expiresAt: Timestamp.fromMillis(now.toMillis() + 600_000),
    photoUrls: ["PRIVATE_PHOTO_FIXTURE"],
    note: "PRIVATE_NOTE_FIXTURE",
    customerSummary: { phone: "PRIVATE_PHONE_FIXTURE", name: "PRIVATE_NAME_FIXTURE" },
  };
  await db.doc(`point_requests/${requestId}`).set(data);
  await db.doc(`chair_sessions/${requestId}`).set({
    ...data,
    status: "pending_approval",
    isOpen: true,
  });
  await db.doc(`active_service_sessions/${pointerId()}`).set({
    salonId,
    customerId: "customer-a",
    sessionId: requestId,
  });
}

const operations = (data: Record<string, unknown> = {}, identity: unknown = auth(ADMIN)) =>
  invoke("getSystemAdminSalonOperations", { salonId: SALON, ...data }, identity);
const manage = (data: Record<string, unknown> = {}, identity: unknown = auth(ADMIN)) =>
  invoke(
    "manageSystemAdminSalon",
    {
      salonId: SALON,
      action: "suspend_salon",
      expectedStatus: "active",
      confirmedSalonName: "Salon Support A",
      reason: "Kiểm tra thao tác quản trị được xác nhận",
      operationId: "supervision-operation-0001",
      ...data,
    },
    identity,
  );

describe("bounded Admin supervision", () => {
  it("accepts a null optional cursor produced by the Firebase callable serializer", async () => {
    await seedPendingRequest();
    await expect(operations({ cursor: null })).resolves.toMatchObject({
      salonId: SALON,
      requests: [expect.objectContaining({ id: "queue-request-a" })],
    });
  });
  it("queries audit events for the selected salon before applying the page limit", async () => {
    const batch = db.batch();
    for (let i = 0; i < 45; i++)
      batch.set(db.doc(`audit_events/noise-${i}`), {
        salonId: OTHER,
        action: "fixture",
        createdAt: Timestamp.fromMillis(100 + i),
      });
    batch.set(db.doc("audit_events/selected-salon-event"), {
      salonId: SALON,
      action: "fixture.selected",
      createdAt: Timestamp.fromMillis(1),
    });
    await batch.commit();
    const result = await invoke("listSystemAdminAuditEvents", { salonId: SALON, pageSize: 10 });
    expect(result.events).toEqual([
      expect.objectContaining({ id: "selected-salon-event", salonId: SALON }),
    ]);
  });
  it("returns the selected salon queue without private customer content", async () => {
    await seedPendingRequest();
    await seedPendingRequest("other-request", OTHER);
    const result = await operations();
    expect(result).toMatchObject({ salonId: SALON, writesEnabled: false, nextCursor: null });
    expect(result.requests).toEqual([
      expect.objectContaining({ id: "queue-request-a", state: "waiting", cancellable: true }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|other-request|customerSummary|photoUrls/);
  });
  it("distinguishes expired and inconsistent requests without mutating them", async () => {
    await seedPendingRequest();
    await db.doc("point_requests/queue-request-a").update({ expiresAt: Timestamp.fromMillis(1) });
    expect((await operations()).requests).toEqual([
      expect.objectContaining({ state: "expired", cancellable: true }),
    ]);
    await db.doc("chair_sessions/queue-request-a").update({ salonId: OTHER });
    expect((await operations()).requests).toEqual([
      expect.objectContaining({ state: "inconsistent", cancellable: false }),
    ]);
    expect((await db.doc("point_requests/queue-request-a").get()).data()?.status).toBe("pending");
  });
  it("paginates a bounded page and rejects a cursor from another salon", async () => {
    for (const requestId of ["queue-a", "queue-b", "queue-c"]) await seedPendingRequest(requestId);
    const first = await operations({ pageSize: 2 });
    expect((first.requests as unknown[]).length).toBe(2);
    expect(first.nextCursor).toBe("queue-b");
    expect((await operations({ pageSize: 2, cursor: first.nextCursor })).requests).toEqual([
      expect.objectContaining({ id: "queue-c" }),
    ]);
    await seedPendingRequest("other-cursor", OTHER);
    await expect(operations({ cursor: "other-cursor" })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });
  it.each([null, auth("ordinary-owner"), auth("unknown-user")])(
    "denies unprivileged queue reads %#",
    async (identity) => {
      await expect(operations({}, identity)).rejects.toMatchObject({
        code: identity ? "permission-denied" : "unauthenticated",
      });
    },
  );
  it.each([
    { salonId: "a/b" },
    { pageSize: 0 },
    { pageSize: 51 },
    { pageSize: 1.5 },
    { cursor: "a/b" },
  ])("rejects unsafe read inputs %#", async (data) => {
    await expect(operations(data)).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("does not make a missing salon look like an empty queue", async () => {
    await expect(operations({ salonId: "missing" })).rejects.toMatchObject({ code: "not-found" });
  });
});

describe("confirmed and isolated Admin controls", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SUPERVISION_WRITES_ENABLED", "true"));
  it("keeps the new controls off unless explicitly enabled, without opening legacy writes", async () => {
    vi.stubEnv("ADMIN_SUPERVISION_WRITES_ENABLED", "false");
    await expect(manage()).rejects.toMatchObject({
      details: { errorCode: "ADMIN_SUPERVISION_DISABLED" },
    });
    expect((await db.doc(`salons/${SALON}`).get()).data()?.status).toBe("active");
  });
  it.each([null, auth("ordinary-owner"), auth("unknown-user")])(
    "rejects unprivileged changes %#",
    async (identity) => {
      await expect(manage({}, identity)).rejects.toMatchObject({
        code: identity ? "permission-denied" : "unauthenticated",
      });
    },
  );
  it("suspends and reactivates only the confirmed salon, with a receipt and audit", async () => {
    await expect(manage()).resolves.toMatchObject({ changed: true, status: "suspended" });
    expect((await db.doc(`salons/${SALON}`).get()).data()).toMatchObject({
      status: "suspended",
      isActive: false,
      customerCount: 99,
    });
    expect((await db.doc(`salons/${OTHER}`).get()).data()?.isActive).toBe(true);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(7);
    expect((await db.collection("audit_events").get()).size).toBe(1);
    await expect(manage()).resolves.toMatchObject({ changed: true, status: "suspended" });
    expect((await db.collection("audit_events").get()).size).toBe(1);
    await expect(
      manage({
        action: "reactivate_salon",
        expectedStatus: "suspended",
        operationId: "supervision-operation-0002",
      }),
    ).resolves.toMatchObject({ status: "active" });
  });
  it.each([{ confirmedSalonName: "Wrong salon" }, { expectedStatus: "suspended" }])(
    "refuses a stale or mismatched confirmation %#",
    async (data) => {
      await expect(manage(data)).rejects.toMatchObject({ code: "failed-precondition" });
    },
  );
  it.each([
    { action: "delete_salon" },
    { action: "set_points" },
    { reason: "" },
    { operationId: "short" },
    { salonId: "a/b" },
  ])("never accepts deletion, point changes or malformed controls %#", async (data) => {
    await expect(manage(data)).rejects.toMatchObject({ code: "invalid-argument" });
  });
  it("requires recent login and rechecks revoked grants before receipt replay", async () => {
    await expect(manage({}, { uid: ADMIN, token: { auth_time: 1 } })).rejects.toMatchObject({
      details: { errorCode: "RECENT_LOGIN_REQUIRED" },
    });
    await manage();
    await db.doc(`system_admin_access/${ADMIN}`).update({ isActive: false });
    await expect(manage()).rejects.toMatchObject({ code: "permission-denied" });
  });
  it("rejects a reused operation id with another action", async () => {
    await manage();
    await expect(
      manage({ action: "reactivate_salon", expectedStatus: "suspended" }),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
  it("cannot reactivate a salon pending deletion", async () => {
    await db.doc(`salons/${SALON}`).update({ status: "pending_deletion" });
    await expect(
      manage({ action: "reactivate_salon", expectedStatus: "pending_deletion" }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("cancels only a pending request atomically, without points, reward or photo deletion", async () => {
    await seedPendingRequest();
    const input = { action: "cancel_point_request", requestId: "queue-request-a" };
    await expect(manage(input)).resolves.toMatchObject({
      changed: true,
      requestId: "queue-request-a",
    });
    expect((await db.doc("point_requests/queue-request-a").get()).data()).toMatchObject({
      status: "rejected",
      photoUrls: ["PRIVATE_PHOTO_FIXTURE"],
    });
    expect((await db.doc("chair_sessions/queue-request-a").get()).data()).toMatchObject({
      status: "cancelled",
      isOpen: false,
    });
    expect((await db.doc(`active_service_sessions/${pointerId()}`).get()).exists).toBe(false);
    expect((await db.doc("customers/customer-a").get()).data()?.points).toBe(7);
    expect((await db.doc("reward_history/reward-a").get()).data()?.status).toBe("unused");
    await expect(manage(input)).resolves.toMatchObject({ changed: true });
    expect((await db.collection("audit_events").get()).size).toBe(1);
  });
  it.each([
    ["point_requests/queue-request-a", { salonId: OTHER }],
    ["point_requests/queue-request-a", { status: "approved" }],
    ["chair_sessions/queue-request-a", { status: "completed" }],
    ["chair_sessions/queue-request-a", { customerId: "customer-b" }],
  ])(
    "refuses requests processed concurrently or belonging to another tenant %#",
    async (path, patch) => {
      await seedPendingRequest();
      await db.doc(path).update(patch);
      await expect(
        manage({ action: "cancel_point_request", requestId: "queue-request-a" }),
      ).rejects.toMatchObject({ code: "failed-precondition" });
      expect((await db.collection("audit_events").get()).empty).toBe(true);
    },
  );
  it("preserves an active pointer now referencing another session", async () => {
    await seedPendingRequest();
    await db.doc(`active_service_sessions/${pointerId()}`).update({ sessionId: "new-session" });
    await manage({ action: "cancel_point_request", requestId: "queue-request-a" });
    expect((await db.doc(`active_service_sessions/${pointerId()}`).get()).data()?.sessionId).toBe(
      "new-session",
    );
  });
});
