import { describe, expect, it } from "vitest";
import {
  runSalonDeletionJob,
  type SalonDeletionAdapter,
  type SalonDeletionAuditAction,
  type SalonDeletionJobPatch,
  type SalonDeletionJobState,
} from "../src/domains/salons/deletionJob";

function createAdapter(input: {
  authUids?: string[];
  initial?: SalonDeletionJobState;
  failOnceFor?: string;
  missingUid?: string;
}) {
  let failOnceFor = input.failOnceFor;
  const state: SalonDeletionJobState = input.initial ?? { status: "requested" };
  const calls = {
    collect: 0,
    auth: [] as string[],
    firestore: 0,
    storage: 0,
    salon: 0,
    audits: [] as SalonDeletionAuditAction[],
  };

  const adapter: SalonDeletionAdapter = {
    async loadJob() {
      return structuredClone(state);
    },
    async updateJob(patch: SalonDeletionJobPatch) {
      const fields = { ...patch };
      delete fields.retryAfterMs;
      delete fields.completedAt;
      Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined) delete (state as Record<string, unknown>)[key];
        else (state as Record<string, unknown>)[key] = structuredClone(value);
      });
    },
    async collectAuthUids() {
      calls.collect += 1;
      return input.authUids ?? [];
    },
    async deleteAuthUser(uid) {
      expect(state.authUids).toContain(uid);
      calls.auth.push(uid);
      if (uid === input.missingUid) throw { code: "auth/user-not-found" };
      if (uid === failOnceFor) {
        failOnceFor = undefined;
        throw { code: "auth/internal-error", message: "sensitive provider detail" };
      }
    },
    async deleteFirestoreData() {
      calls.firestore += 1;
      return 12;
    },
    async deleteStorageData() {
      calls.storage += 1;
    },
    async deleteSalonDocument() {
      calls.salon += 1;
    },
    async writeAudit(action) {
      calls.audits.push(action);
    },
  };

  return { adapter, state, calls };
}

describe("salon deletion job", () => {
  it("lưu snapshot UID trước rồi mới xóa toàn bộ Auth và dữ liệu", async () => {
    const context = createAdapter({ authUids: ["owner-1", "staff-1"] });

    await expect(runSalonDeletionJob(context.adapter)).resolves.toMatchObject({
      status: "completed",
      deletedDocuments: 12,
    });
    expect(context.calls.auth).toEqual(["owner-1", "staff-1"]);
    expect(context.calls.firestore).toBe(1);
    expect(context.calls.storage).toBe(1);
    expect(context.state.status).toBe("completed");
    expect(context.calls.audits).toContain("salon.deletion_completed");
  });

  it("không hoàn tất khi một UID xóa Auth thất bại", async () => {
    const context = createAdapter({
      authUids: ["owner-2", "staff-fail"],
      failOnceFor: "staff-fail",
    });

    await expect(runSalonDeletionJob(context.adapter)).resolves.toEqual({
      status: "failed",
      failedAuthUids: 1,
    });
    expect(context.state.status).toBe("failed");
    expect(context.state.authFailedUids).toEqual([
      {
        uid: "staff-fail",
        code: "auth/internal-error",
        message: "Không xóa được tài khoản Firebase Authentication",
      },
    ]);
    expect(context.calls.firestore).toBe(0);
    expect(context.calls.storage).toBe(0);
    expect(context.calls.audits).toContain("salon.deletion_failed");
  });

  it("chạy lại sau lỗi chỉ thử UID chưa xóa và hoàn tất an toàn", async () => {
    const context = createAdapter({
      authUids: ["owner-3", "staff-retry"],
      failOnceFor: "staff-retry",
    });

    await runSalonDeletionJob(context.adapter);
    await expect(runSalonDeletionJob(context.adapter)).resolves.toMatchObject({
      status: "completed",
    });

    expect(context.calls.auth).toEqual(["owner-3", "staff-retry", "staff-retry"]);
    expect(context.state.status).toBe("completed");
    expect(context.calls.firestore).toBe(1);
    expect(context.calls.storage).toBe(1);
  });

  it("dùng UID đã lưu trong job dù user document không còn", async () => {
    const context = createAdapter({
      initial: {
        status: "failed",
        resumeStatus: "deleting_auth_accounts",
        authUids: ["persisted-owner"],
        authDeletedUids: [],
        authFailedUids: [],
      },
    });

    await runSalonDeletionJob(context.adapter);
    expect(context.calls.collect).toBe(0);
    expect(context.calls.auth).toEqual(["persisted-owner"]);
    expect(context.state.status).toBe("completed");
  });

  it("coi Auth UID đã không tồn tại là kết quả xóa an toàn", async () => {
    const context = createAdapter({ authUids: ["already-missing"], missingUid: "already-missing" });

    await runSalonDeletionJob(context.adapter);
    expect(context.state.status).toBe("completed");
    expect(context.calls.audits).toContain("salon.auth_account_deleted");
  });

  it("không chạy lại các bước xóa khi job đã completed", async () => {
    const context = createAdapter({ initial: { status: "completed" } });

    await runSalonDeletionJob(context.adapter);
    await runSalonDeletionJob(context.adapter);
    expect(context.calls).toMatchObject({
      collect: 0,
      auth: [],
      firestore: 0,
      storage: 0,
      salon: 0,
    });
  });
});
