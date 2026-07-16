import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getZaloIdentity, requestPhoneToken } from "./zalo";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getPhoneNumber: vi.fn(),
  getUserInfo: vi.fn(),
  isZaloMiniAppRuntime: vi.fn(),
}));

vi.mock("./runtime", () => ({
  isZaloMiniAppRuntime: mocks.isZaloMiniAppRuntime,
}));

vi.mock("zmp-sdk/apis", () => ({
  getAccessToken: mocks.getAccessToken,
  getPhoneNumber: mocks.getPhoneNumber,
  getUserInfo: mocks.getUserInfo,
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

  it("dùng danh tính mô phỏng chỉ trong chế độ xem trước", async () => {
    vi.stubEnv("VITE_ZALO_PREVIEW", "true");

    await expect(getZaloIdentity()).resolves.toMatchObject({
      zaloUserId: "preview-zalo-user",
      name: "Khách xem trước",
    });
    expect(mocks.getAccessToken).not.toHaveBeenCalled();
  });
});

describe("requestPhoneToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
  });

  it("trả phone token khi khách đồng ý chia sẻ số Zalo", async () => {
    mocks.getPhoneNumber.mockResolvedValue({ token: " phone-token-test " });

    await expect(requestPhoneToken()).resolves.toBe("phone-token-test");
  });

  it("trả null khi khách từ chối quyền số điện thoại", async () => {
    mocks.getPhoneNumber.mockRejectedValue(new Error("permission denied"));

    await expect(requestPhoneToken()).resolves.toBeNull();
  });
});
