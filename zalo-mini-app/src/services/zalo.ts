import { isZaloMiniAppRuntime } from "./runtime";

export type ZaloIdentity = {
  accessToken: string;
  zaloUserId?: string;
  name: string;
  avatar?: string;
};

const ZALO_REQUIRED_MESSAGE = "Vui lòng mở HAIRCUT trong Zalo để xác nhận danh tính khách hàng.";

export async function getZaloAccessToken(): Promise<string> {
  if (!isZaloMiniAppRuntime()) {
    throw new Error(ZALO_REQUIRED_MESSAGE);
  }

  try {
    const { getAccessToken } = await import("zmp-sdk/apis");
    const token = String(await getAccessToken()).trim();

    if (!token || token.toUpperCase().includes("DEFAULT ACCESS TOKEN")) {
      throw new Error("Zalo access token không hợp lệ");
    }

    return token;
  } catch {
    throw new Error(ZALO_REQUIRED_MESSAGE);
  }
}

export async function getZaloIdentity(): Promise<ZaloIdentity> {
  const accessToken = await getZaloAccessToken();

  try {
    const { getUserInfo } = await import("zmp-sdk/apis");
    const { userInfo } = await getUserInfo({
      autoRequestPermission: true,
      avatarType: "normal",
    });
    const rawUserInfo = userInfo as { id?: unknown; userId?: unknown };

    return {
      accessToken,
      zaloUserId: String(rawUserInfo.id || rawUserInfo.userId || "").trim() || undefined,
      name: userInfo.name || "Khách hàng",
      avatar: userInfo.avatar,
    };
  } catch {
    return {
      accessToken,
      name: "Khách hàng",
    };
  }
}

export async function requestPhoneToken(): Promise<string | null> {
  if (!isZaloMiniAppRuntime()) {
    return null;
  }

  try {
    const { getPhoneNumber } = await import("zmp-sdk/apis");
    const { token } = await getPhoneNumber();
    return token;
  } catch {
    return null;
  }
}
