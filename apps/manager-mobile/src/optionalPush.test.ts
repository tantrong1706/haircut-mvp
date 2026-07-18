import { describe, expect, it, vi } from "vitest";
import {
  createPushInitializationSingleFlight,
  runOptionalPushInitialization,
} from "./optionalPush";

describe("khởi tạo thông báo không chặn Manager", () => {
  it("trả trạng thái sẵn sàng và giữ cleanup khi push hoạt động", async () => {
    const cleanup = vi.fn();
    const result = await runOptionalPushInitialization({
      initialize: async () => ({ status: "ready", cleanup }),
      onWarning: vi.fn(),
    });

    expect(result.status).toBe("ready");
    await result.cleanup();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("giữ trạng thái từ chối mà không biến thành lỗi bootstrap", async () => {
    const warning = vi.fn();
    const result = await runOptionalPushInitialization({
      initialize: async () => ({ status: "denied", cleanup: async () => undefined }),
      onWarning: warning,
    });

    expect(result.status).toBe("denied");
    expect(warning).not.toHaveBeenCalled();
  });

  it("hạ lỗi plugin thành cảnh báo không chặn", async () => {
    const warning = vi.fn();
    const result = await runOptionalPushInitialization({
      initialize: async () => {
        throw new Error("MANAGER_PUSH_PLUGIN_FAILED");
      },
      onWarning: warning,
    });

    expect(result.status).toBe("unavailable");
    expect(warning).toHaveBeenCalledWith("MANAGER_PUSH_PLUGIN_FAILED");
  });

  it("hạ timeout thành cảnh báo và dọn initialization đến muộn", async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();
    let resolveInitialization:
      | ((value: { status: "ready"; cleanup: () => void }) => void)
      | undefined;
    const initialization = new Promise<{ status: "ready"; cleanup: () => void }>((resolve) => {
      resolveInitialization = resolve;
    });
    const warning = vi.fn();
    const pending = runOptionalPushInitialization({
      initialize: async () => initialization,
      timeoutMs: 10,
      onWarning: warning,
    });

    await vi.advanceTimersByTimeAsync(11);
    await expect(pending).resolves.toMatchObject({ status: "unavailable" });
    expect(warning).toHaveBeenCalledWith("MANAGER_PUSH_TIMEOUT");

    resolveInitialization?.({ status: "ready", cleanup });
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(cleanup).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("không đăng ký listener trùng khi hai lần khởi tạo chạy đồng thời", async () => {
    let resolveInitialization:
      | ((value: {
          status: "ready";
          cleanup: () => void;
        }) => void)
      | undefined;
    const initialize = vi.fn(
      () =>
        new Promise<{ status: "ready"; cleanup: () => void }>((resolve) => {
          resolveInitialization = resolve;
        }),
    );
    const initializeOnce = createPushInitializationSingleFlight(initialize);

    const first = initializeOnce("owner-1");
    const second = initializeOnce("owner-1");
    expect(initialize).toHaveBeenCalledOnce();

    resolveInitialization?.({ status: "ready", cleanup: vi.fn() });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });
});
