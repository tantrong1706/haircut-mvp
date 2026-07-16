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

export async function runManagerBootstrap(input: {
  initialize: () => Promise<Cleanup>;
  hideSplash: () => Promise<boolean>;
  track: (name: string, params: Record<string, string>) => void;
  timeoutMs?: number;
}) {
  const requestId = safeRequestId();
  const initialization = Promise.resolve().then(input.initialize);
  let timedOut = false;

  try {
    const cleanup = await withTimeout(initialization, input.timeoutMs ?? 20_000, () => {
      timedOut = true;
    });
    return { ok: true as const, cleanup, requestId };
  } catch (error) {
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
    if (timedOut) {
      void initialization.then((cleanup) => cleanup()).catch(() => undefined);
    }
    if (!(await input.hideSplash())) {
      input.track("manager_splash_hide_failed", {
        error_code: "MANAGER_SPLASH_HIDE_FAILED",
        request_id: requestId,
      });
    }
  }
}

export function createSingleFlight<TInput, TResult>(task: (input: TInput) => Promise<TResult>) {
  let inFlight: Promise<TResult> | null = null;
  return (input: TInput) => {
    if (!inFlight) {
      inFlight = task(input).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
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
