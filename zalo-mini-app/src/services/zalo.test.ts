import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyZaloProfileError,
  getZaloIdentity,
  isZaloProfilePermissionError,
  isZaloProfileRetryableError,
  openZaloProfilePermissionSettings,
} from "./zalo";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  isZaloMiniAppRuntime: vi.fn(),
  openPermissionSetting: vi.fn(),
}));

vi.mock("./runtime", () => ({
  isZaloMiniAppRuntime: mocks.isZaloMiniAppRuntime,
}));

vi.mock("zmp-sdk/apis", () => ({
  getAccessToken: mocks.getAccessToken,
  getUserInfo: mocks.getUserInfo,
  openPermissionSetting: mocks.openPermissionSetting,
}));

describe("getZaloIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
    mocks.getAccessToken.mockResolvedValue("access-token-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("không tự gán tên chung khi khách từ chối quyền hồ sơ", async () => {
    mocks.getUserInfo.mockRejectedValue(new Error("permission denied"));

    await expect(getZaloIdentity()).resolves.toEqual({
      accessToken: "access-token-test",
      name: "",
    });
    expect(mocks.getUserInfo).toHaveBeenCalledWith({
      autoRequestPermission: false,
      avatarType: "normal",
    });
  });

  it("trả tên hồ sơ khi Zalo cấp quyền", async () => {
    mocks.getUserInfo.mockResolvedValue({
      userInfo: { id: "zalo-a", name: "Anh Tân", avatar: "https://example.com/avatar.jpg" },
    });

    await expect(getZaloIdentity()).resolves.toMatchObject({
      zaloUserId: "zalo-a",
      name: "Anh Tân",
    });
  });

  it("chỉ mở hộp thoại quyền hồ sơ khi người dùng chủ động yêu cầu", async () => {
    mocks.getUserInfo.mockResolvedValue({
      userInfo: { id: "zalo-a", name: "Anh Tân" },
    });

    await getZaloIdentity({ requestProfilePermission: true });

    expect(mocks.getUserInfo).toHaveBeenCalledWith({
      autoRequestPermission: true,
      avatarType: "normal",
    });
  });

  it("yêu cầu mở cài đặt khi quyền hồ sơ đã bị từ chối", async () => {
    mocks.getUserInfo.mockRejectedValue(new Error("permission denied"));

    await expect(getZaloIdentity({ requestProfilePermission: true })).rejects.toMatchObject({
      code: "ZALO_PROFILE_PERMISSION_REQUIRED",
    });
  });

  it("phân loại đúng mã từ chối quyền hồ sơ chính thức của SDK", () => {
    expect(classifyZaloProfileError({ code: -1401, message: "Unauthorized" })).toMatchObject({
      kind: "permission",
    });
    expect(classifyZaloProfileError({ code: "-2002", message: "User denied" })).toMatchObject({
      kind: "permission",
    });
  });

  it.each([
    [{ code: -1408, message: "Request timeout" }, "timeout"],
    [new Error("No internet connection"), "network"],
    [new Error("SDK bridge unavailable"), "unavailable"],
  ])("không phân loại lỗi vận hành %s thành lỗi quyền", (error, kind) => {
    expect(classifyZaloProfileError(error)).toMatchObject({ kind });
  });

  it.each([
    [new Error("No internet connection"), "network"],
    [{ code: -1408, message: "Request timeout" }, "timeout"],
    [new Error("SDK bridge unavailable"), "unavailable"],
  ])("giữ lỗi %s ở luồng thử lại thay vì mở cài đặt", async (error, kind) => {
    mocks.getUserInfo.mockRejectedValue(error);

    const result = getZaloIdentity({ requestProfilePermission: true });

    await expect(result).rejects.toMatchObject({
      code: "ZALO_PROFILE_RETRY_REQUIRED",
      kind,
    });
    await expect(result).rejects.not.toSatisfy(isZaloProfilePermissionError);
  });

  it("không che lỗi mạng ở lần đọc hồ sơ thụ động thành hồ sơ rỗng", async () => {
    mocks.getUserInfo.mockRejectedValue(new Error("Failed to fetch"));

    const result = getZaloIdentity();

    await expect(result).rejects.toSatisfy(isZaloProfileRetryableError);
  });

  it("mở cài đặt quyền Zalo bằng SDK", async () => {
    mocks.openPermissionSetting.mockResolvedValue(undefined);

    await openZaloProfilePermissionSettings();

    expect(mocks.openPermissionSetting).toHaveBeenCalledTimes(1);
  });

  it("dùng danh tính mô phỏng chỉ trong chế độ xem trước", async () => {
    vi.stubEnv("VITE_ZALO_PREVIEW", "true");

    await expect(getZaloIdentity()).resolves.toMatchObject({
      zaloUserId: "preview-zalo-user",
      name: "Khách xem trước",
    });
    expect(mocks.getAccessToken).not.toHaveBeenCalled();
  });
});
