import { beforeEach, describe, expect, it, vi } from "vitest";
import { getZaloIdentity } from "./zalo";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  isZaloMiniAppRuntime: vi.fn(),
}));

vi.mock("./runtime", () => ({
  isZaloMiniAppRuntime: mocks.isZaloMiniAppRuntime,
}));

vi.mock("zmp-sdk/apis", () => ({
  getAccessToken: mocks.getAccessToken,
  getUserInfo: mocks.getUserInfo,
}));

describe("getZaloIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
    mocks.getAccessToken.mockResolvedValue("access-token-test");
  });

  it("không tự gán tên chung khi khách từ chối quyền hồ sơ", async () => {
    mocks.getUserInfo.mockRejectedValue(new Error("permission denied"));

    await expect(getZaloIdentity()).resolves.toEqual({
      accessToken: "access-token-test",
      name: "",
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
});
