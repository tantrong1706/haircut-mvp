import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getZaloIdentity, openZaloProfilePermissionSettings } from "./zalo";

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

    await expect(
      getZaloIdentity({ requestProfilePermission: true }),
    ).rejects.toMatchObject({
      code: "ZALO_PROFILE_PERMISSION_REQUIRED",
    });
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
