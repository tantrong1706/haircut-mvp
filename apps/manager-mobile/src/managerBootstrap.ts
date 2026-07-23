export type ManagerBootstrapCode =
  | "MANAGER_FIREBASE_INIT_FAILED"
  | "MANAGER_APP_CHECK_FAILED"
  | "MANAGER_NATIVE_PLUGIN_FAILED"
  | "MANAGER_BOOTSTRAP_TIMEOUT";

export class ManagerBootstrapError extends Error {
  constructor(
    readonly code: ManagerBootstrapCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ManagerBootstrapError";
  }
}

type Cleanup = () => void | Promise<void>;

export type InitializationAttemptContext = {
  attemptId: number;
  key: string;
  isActive: () => boolean;
};

export type InitializationAttempt<TResult> = {
  attemptId: number;
  key: string;
  result: Promise<TResult>;
  isActive: () => boolean;
  isStale: () => boolean;
  invalidate: () => Promise<void>;
};

export class StaleInitializationError extends Error {
  constructor() {
    super("STALE_INITIALIZATION_ATTEMPT");
    this.name = "StaleInitializationError";
  }
}

export async function runManagerBootstrap(input: {
  attempt: InitializationAttempt<Cleanup>;
  hideSplash: () => Promise<boolean>;
  track: (name: string, params: Record<string, string>) => void;
  timeoutMs?: number;
}) {
  const requestId = safeRequestId();
  let timedOut = false;

  try {
    await withTimeout(input.attempt.result, input.timeoutMs ?? 20_000, () => {
      timedOut = true;
    });
    return { ok: true as const, cleanup: input.attempt.invalidate, requestId };
  } catch (error) {
    if (timedOut) {
      await input.attempt.invalidate();
    }
    if (error instanceof StaleInitializationError) {
      return {
        ok: false as const,
        stale: true as const,
        code: "MANAGER_NATIVE_PLUGIN_FAILED" as const,
        requestId,
        message: safeBootstrapMessage("MANAGER_NATIVE_PLUGIN_FAILED"),
      };
    }
    const code = bootstrapCode(error);
    if (code === "MANAGER_APP_CHECK_FAILED") {
      input.track("manager_app_check_failed", { error_code: code, request_id: requestId });
    }
    input.track("manager_bootstrap_failed", { error_code: code, request_id: requestId });
    return {
      ok: false as const,
      code,
      requestId,
      message: safeBootstrapMessage(code),
    };
  } finally {
    let splashHidden = false;
    try {
      splashHidden = await input.hideSplash();
    } catch {
      splashHidden = false;
    }
    if (!splashHidden) {
      input.track("manager_splash_hide_failed", {
        error_code: "MANAGER_SPLASH_HIDE_FAILED",
        request_id: requestId,
      });
    }
  }
}

export function createSingleFlight<TInput, TResult>(
  task: (input: TInput, context: InitializationAttemptContext) => Promise<TResult>,
  options: {
    cleanup?: (result: TResult) => void | Promise<void>;
    onActivate?: () => void;
    onDeactivate?: () => void;
  } = {},
) {
  type AttemptState = {
    attemptId: number;
    key: string;
    stale: boolean;
    deactivated: boolean;
    cleanup?: () => Promise<void>;
    rejectAsStale: () => void;
    handle: InitializationAttempt<TResult>;
  };

  let current: AttemptState | null = null;
  let nextAttemptId = 0;

  const deactivate = (state: AttemptState) => {
    if (state.deactivated) return;
    state.deactivated = true;
    options.onDeactivate?.();
  };

  const invalidate = async (state: AttemptState) => {
    if (!state.stale) {
      state.stale = true;
      if (current === state) current = null;
      deactivate(state);
      state.rejectAsStale();
    }
    await state.cleanup?.();
  };

  return (key: string, input: TInput): InitializationAttempt<TResult> => {
    if (current && !current.stale && current.key === key) {
      return current.handle;
    }
    if (current) void invalidate(current);

    const attemptId = ++nextAttemptId;
    let rejectAsStale!: () => void;
    const stalePromise = new Promise<never>((_, reject) => {
      rejectAsStale = () => reject(new StaleInitializationError());
    });
    const state = {
      attemptId,
      key,
      stale: false,
      deactivated: false,
      rejectAsStale,
    } as AttemptState;
    const context: InitializationAttemptContext = {
      attemptId,
      key,
      isActive: () => current === state && !state.stale,
    };

    current = state;
    options.onActivate?.();

    const taskResult = Promise.resolve()
      .then(() => task(input, context))
      .then(
        async (result) => {
          state.cleanup = onceAsync(() => options.cleanup?.(result));
          if (state.stale) await state.cleanup();
          return result;
        },
        (error) => {
          if (current === state) current = null;
          deactivate(state);
          throw error;
        },
      );

    const handle: InitializationAttempt<TResult> = {
      attemptId,
      key,
      result: Promise.race([taskResult, stalePromise]),
      isActive: context.isActive,
      isStale: () => state.stale,
      invalidate: () => invalidate(state),
    };
    state.handle = handle;
    void handle.result.catch(() => undefined);
    return handle;
  };
}

function onceAsync(task: () => void | Promise<void>) {
  let promise: Promise<void> | null = null;
  return () => {
    if (!promise) promise = Promise.resolve().then(task);
    return promise;
  };
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, onTimeout: () => void) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      onTimeout();
      reject(new ManagerBootstrapError("MANAGER_BOOTSTRAP_TIMEOUT"));
    }, timeoutMs);
    task.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function bootstrapCode(error: unknown): ManagerBootstrapCode {
  if (error instanceof ManagerBootstrapError) return error.code;
  return "MANAGER_NATIVE_PLUGIN_FAILED";
}

function safeBootstrapMessage(code: ManagerBootstrapCode) {
  if (code === "MANAGER_FIREBASE_INIT_FAILED") {
    return "Ứng dụng chưa kết nối được Firebase. Vui lòng kiểm tra cấu hình rồi thử lại.";
  }
  if (code === "MANAGER_APP_CHECK_FAILED") {
    return "Thiết bị chưa vượt qua kiểm tra bảo mật. Vui lòng kiểm tra kết nối rồi thử lại.";
  }
  if (code === "MANAGER_BOOTSTRAP_TIMEOUT") {
    return "Ứng dụng khởi động quá lâu. Vui lòng kiểm tra mạng rồi thử lại.";
  }
  return "Không khởi tạo được tính năng trên thiết bị. Vui lòng thử lại.";
}

function safeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `manager-${Date.now().toString(36)}`;
}
