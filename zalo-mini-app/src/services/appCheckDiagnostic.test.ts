import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  deleteApp: vi.fn(),
  getFirebaseApp: vi.fn(),
  initializeAppCheck: vi.fn(),
  getToken: vi.fn(),
}));
vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp, deleteApp: mocks.deleteApp }));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mocks.initializeAppCheck,
  getToken: mocks.getToken,
  ReCaptchaEnterpriseProvider: class {},
}));
vi.mock("./firebase", () => ({ getFirebaseApp: mocks.getFirebaseApp }));
import { runAppCheckDiagnostic } from "./appCheckDiagnostic";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_SITE_KEY", "public-test-key");
  mocks.getFirebaseApp.mockReturnValue({ options: { projectId: "test-project" } });
  mocks.initializeApp.mockReturnValue({ name: "probe" });
  mocks.initializeAppCheck.mockReturnValue({});
  mocks.deleteApp.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("App Check diagnostic", () => {
  it("không tính debug provider là xác thực thật", async () => {
    vi.stubGlobal("FIREBASE_APPCHECK_DEBUG_TOKEN", true);
    expect(await runAppCheckDiagnostic()).toEqual({
      status: "failed",
      code: "DEBUG_MODE_NOT_ALLOWED",
    });
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });
  it("không chạy khi Firebase app chưa có", async () => {
    mocks.getFirebaseApp.mockReturnValue(null);
    expect(await runAppCheckDiagnostic()).toEqual({ status: "failed", code: "NOT_CONFIGURED" });
  });
  it("không coi phản hồi trống là thành công", async () => {
    mocks.getToken.mockResolvedValue({ token: "" });
    expect(await runAppCheckDiagnostic()).toEqual({ status: "failed", code: "EMPTY_RESPONSE" });
  });
  it("trả trạng thái thành công mà không lộ token và tắt tự làm mới", async () => {
    mocks.getToken.mockResolvedValue({ token: "sensitive-test-token" });
    const result = await runAppCheckDiagnostic();
    expect(result).toEqual({ status: "passed" });
    expect(JSON.stringify(result)).not.toContain("sensitive-test-token");
    expect(mocks.initializeAppCheck).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTokenAutoRefreshEnabled: false }),
    );
    expect(mocks.deleteApp).toHaveBeenCalledOnce();
  });
  it("chỉ trả mã lỗi và HTTP, không đưa chi tiết credential vào UI", async () => {
    mocks.getToken.mockRejectedValue({
      code: "appCheck/initial-throttle",
      customData: { httpStatus: 403 },
      message: "private-token-value",
    });
    expect(await runAppCheckDiagnostic()).toEqual({
      status: "failed",
      code: "appCheck/initial-throttle",
      httpStatus: 403,
    });
    expect(mocks.deleteApp).toHaveBeenCalledOnce();
  });
  it("lọc thông báo và mã lỗi không tin cậy", async () => {
    mocks.getToken.mockRejectedValue({
      code: "secret-value",
      customData: { httpStatus: "secret" },
    });
    expect(await runAppCheckDiagnostic()).toEqual({ status: "failed", code: "CHECK_FAILED" });
  });
  it("không khởi tạo provider khi chưa cấu hình", async () => {
    vi.stubEnv("VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_SITE_KEY", "");
    expect(await runAppCheckDiagnostic()).toEqual({ status: "failed", code: "NOT_CONFIGURED" });
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
  });
  it("kết thúc chờ sau 25 giây và dọn instance kiểm tra", async () => {
    vi.useFakeTimers();
    mocks.getToken.mockReturnValue(new Promise(() => undefined));
    const pending = runAppCheckDiagnostic();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await pending).toEqual({ status: "failed", code: "CHECK_TIMEOUT" });
    expect(mocks.deleteApp).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
