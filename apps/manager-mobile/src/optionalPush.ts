export type PushInitializationStatus = "ready" | "denied" | "unavailable";

export type PushInitializationResult = {
  status: PushInitializationStatus;
  cleanup: () => void | Promise<void>;
};

export function createPushInitializationSingleFlight(
  initialize: (userKey: string) => Promise<PushInitializationResult>,
) {
  let inFlight: Promise<PushInitializationResult> | null = null;
  return (userKey: string) => {
    if (!inFlight) {
      inFlight = initialize(userKey).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

export async function runOptionalPushInitialization(input: {
  initialize: () => Promise<PushInitializationResult>;
  timeoutMs?: number;
  onWarning: (code: string) => void;
}): Promise<PushInitializationResult> {
  const initialization = Promise.resolve().then(input.initialize);
  let timedOut = false;

  try {
    return await withTimeout(initialization, input.timeoutMs ?? 12_000, () => {
      timedOut = true;
    });
  } catch (error) {
    const code = timedOut ? "MANAGER_PUSH_TIMEOUT" : pushErrorCode(error);
    input.onWarning(code);
    if (timedOut) {
      void initialization.then((result) => result.cleanup()).catch(() => undefined);
    }
    return {
      status: "unavailable",
      cleanup: async () => undefined,
    };
  }
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
