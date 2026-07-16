import { createHash } from "node:crypto";

export type SalonDeletionPhase =
  | "collecting_accounts"
  | "deleting_auth_accounts"
  | "deleting_firestore_data"
  | "deleting_storage_data";

export type SalonDeletionStatus =
  "pending" | "requested" | SalonDeletionPhase | "failed" | "completed";

export type AuthDeletionFailure = {
  uid: string;
  code: string;
  message: string;
};

export type SalonDeletionJobState = {
  status: SalonDeletionStatus;
  resumeStatus?: SalonDeletionPhase;
  authUids?: string[];
  authDeletedUids?: string[];
  authFailedUids?: AuthDeletionFailure[];
  deletionStartedAt?: unknown;
};

export type SalonDeletionJobPatch = Partial<SalonDeletionJobState> & {
  retryAfterMs?: number;
  completedAt?: boolean;
};

export type SalonDeletionAuditAction =
  | "salon.deletion_started"
  | "salon.auth_account_deleted"
  | "salon.auth_account_delete_failed"
  | "salon.deletion_completed"
  | "salon.deletion_failed";

export type SalonDeletionAdapter = {
  loadJob(): Promise<SalonDeletionJobState>;
  updateJob(patch: SalonDeletionJobPatch): Promise<void>;
  collectAuthUids(): Promise<string[]>;
  deleteAuthUser(uid: string): Promise<void>;
  deleteFirestoreData(): Promise<number>;
  deleteStorageData(): Promise<void>;
  deleteSalonDocument(): Promise<void>;
  writeAudit(action: SalonDeletionAuditAction, metadata?: Record<string, unknown>): Promise<void>;
};

export type SalonDeletionRunResult = {
  status: "completed" | "failed";
  deletedDocuments?: number;
  failedAuthUids?: number;
};

const RETRY_DELAY_MS = 15 * 60 * 1000;

export async function runSalonDeletionJob(
  adapter: SalonDeletionAdapter,
): Promise<SalonDeletionRunResult> {
  let job = await adapter.loadJob();
  if (job.status === "completed") {
    return { status: "completed" };
  }
  let phase: SalonDeletionPhase = resumePhase(job);

  try {
    if (!Array.isArray(job.authUids)) {
      phase = "collecting_accounts";
      await adapter.updateJob({ status: phase });
      const authUids = uniqueStrings(await adapter.collectAuthUids());
      job = {
        ...job,
        status: "deleting_auth_accounts",
        authUids,
        authDeletedUids: [],
        authFailedUids: [],
      };
      await adapter.updateJob(job);
    }

    await adapter.writeAudit("salon.deletion_started", {
      authAccountCount: job.authUids?.length ?? 0,
    });

    phase = "deleting_auth_accounts";
    await adapter.updateJob({ status: phase, resumeStatus: phase });
    const authResult = await deleteAuthAccounts(adapter, job);
    if (authResult.failures.length > 0) {
      await markFailed(adapter, phase, "AUTH_ACCOUNT_DELETE_FAILED", {
        authFailedUids: authResult.failures,
        authDeletedUids: authResult.deletedUids,
      });
      return { status: "failed", failedAuthUids: authResult.failures.length };
    }

    phase = "deleting_firestore_data";
    await adapter.updateJob({
      status: phase,
      resumeStatus: phase,
      authDeletedUids: authResult.deletedUids,
      authFailedUids: [],
    });
    const deletedDocuments = await adapter.deleteFirestoreData();

    phase = "deleting_storage_data";
    await adapter.updateJob({ status: phase, resumeStatus: phase });
    await adapter.deleteStorageData();
    await adapter.deleteSalonDocument();

    await adapter.updateJob({
      status: "completed",
      resumeStatus: undefined,
      authUids: undefined,
      authDeletedUids: undefined,
      authFailedUids: [],
      completedAt: true,
    });
    await adapter.writeAudit("salon.deletion_completed", {
      authAccountCount: authResult.deletedUids.length,
      deletedDocuments,
    });
    return { status: "completed", deletedDocuments };
  } catch (error) {
    await markFailed(adapter, phase, safeErrorCode(error));
    return { status: "failed" };
  }
}

async function deleteAuthAccounts(adapter: SalonDeletionAdapter, job: SalonDeletionJobState) {
  const authUids = uniqueStrings(job.authUids ?? []);
  const deleted = new Set(uniqueStrings(job.authDeletedUids ?? []));
  const failures: AuthDeletionFailure[] = [];

  for (const uid of authUids) {
    if (deleted.has(uid)) continue;
    try {
      await adapter.deleteAuthUser(uid);
      deleted.add(uid);
      await adapter.updateJob({
        status: "deleting_auth_accounts",
        authDeletedUids: [...deleted],
        authFailedUids: failures,
      });
      await adapter.writeAudit("salon.auth_account_deleted", {
        accountRef: accountReference(uid),
        alreadyMissing: false,
      });
    } catch (error) {
      if (isAuthUserNotFound(error)) {
        deleted.add(uid);
        await adapter.updateJob({
          status: "deleting_auth_accounts",
          authDeletedUids: [...deleted],
          authFailedUids: failures,
        });
        await adapter.writeAudit("salon.auth_account_deleted", {
          accountRef: accountReference(uid),
          alreadyMissing: true,
        });
        continue;
      }

      const failure = {
        uid,
        code: safeErrorCode(error),
        message: "Không xóa được tài khoản Firebase Authentication",
      };
      failures.push(failure);
      await adapter.updateJob({
        status: "deleting_auth_accounts",
        authDeletedUids: [...deleted],
        authFailedUids: failures,
      });
      await adapter.writeAudit("salon.auth_account_delete_failed", {
        accountRef: accountReference(uid),
        errorCode: failure.code,
      });
    }
  }

  return { deletedUids: [...deleted], failures };
}

async function markFailed(
  adapter: SalonDeletionAdapter,
  phase: SalonDeletionPhase,
  errorCode: string,
  patch: SalonDeletionJobPatch = {},
) {
  await adapter.updateJob({
    ...patch,
    status: "failed",
    resumeStatus: phase,
    retryAfterMs: RETRY_DELAY_MS,
  });
  await adapter.writeAudit("salon.deletion_failed", { phase, errorCode });
}

function resumePhase(job: SalonDeletionJobState): SalonDeletionPhase {
  if (job.status === "failed" && job.resumeStatus) return job.resumeStatus;
  if (
    job.status === "collecting_accounts" ||
    job.status === "deleting_auth_accounts" ||
    job.status === "deleting_firestore_data" ||
    job.status === "deleting_storage_data"
  ) {
    return job.status;
  }
  return "collecting_accounts";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function accountReference(uid: string) {
  return createHash("sha256").update(uid).digest("hex").slice(0, 16);
}

function safeErrorCode(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "deletion_failed")
    .replace(/[^A-Za-z0-9_/-]/g, "_")
    .slice(0, 80);
  return code || "deletion_failed";
}

function isAuthUserNotFound(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "").toLowerCase();
  return code === "auth/user-not-found" || code === "user-not-found";
}
