import {
  createSingleFlight,
  StaleInitializationError,
  type InitializationAttempt,
  type InitializationAttemptContext,
} from "./managerBootstrap";

export type PushInitializationStatus = "ready" | "denied" | "unavailable";

export type PushInitializationResult = {
  status: PushInitializationStatus;
  cleanup: () => void | Promise<void>;
};

export type PushInitializationAttempt = InitializationAttempt<PushInitializationResult>;

export function createPushInitializationSingleFlight(
  initialize: (
    userKey: string,
    context: InitializationAttemptContext,
  ) => Promise<PushInitializationResult>,
) {
  const start = createSingleFlight((userKey: string, context) => initialize(userKey, context), {
    cleanup: (result) => result.cleanup(),
  });
  return (userKey: string) => start(userKey, userKey);
}

export async function runOptionalPushInitialization(input: {
  attempt: PushInitializationAttempt;
  timeoutMs?: number;
  onWarning: (code: string) => void;
}): Promise<PushInitializationResult> {
  let timedOut = false;

  try {
    const result = await withTimeout(input.attempt.result, input.timeoutMs ?? 12_000, () => {
      timedOut = true;
    });
    return {
      status: result.status,
      cleanup: input.attempt.invalidate,
    };
  } catch (error) {
    const staleBeforeTimeout = input.attempt.isStale();
    if (timedOut) await input.attempt.invalidate();
    if (staleBeforeTimeout || error instanceof StaleInitializationError) {
      return unavailableResult();
    }
    const code = timedOut ? "MANAGER_PUSH_TIMEOUT" : pushErrorCode(error);
    input.onWarning(code);
    return unavailableResult();
  }
}

function unavailableResult(): PushInitializationResult {
  return {
    status: "unavailable",
    cleanup: async () => undefined,
  };
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, onTimeout: () => void) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      onTimeout();
      reject(new Error("MANAGER_PUSH_TIMEOUT"));
    }, timeoutMs);
    task.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function pushErrorCode(error: unknown) {
  if (error instanceof Error && /^MANAGER_PUSH_[A-Z_]+$/.test(error.message)) {
    return error.message;
  }
  return "MANAGER_PUSH_UNAVAILABLE";
}
