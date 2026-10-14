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
