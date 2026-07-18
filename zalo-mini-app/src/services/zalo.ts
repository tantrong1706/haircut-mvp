import { isZaloMiniAppRuntime } from "./runtime";

export type ZaloIdentity = {
  accessToken: string;
  zaloUserId?: string;
  name: string;
  avatar?: string;
};

type ZaloIdentityOptions = {
  requestProfilePermission?: boolean;
};

const ZALO_REQUIRED_MESSAGE = "Vui lòng mở HAIRCUT trong Zalo để xác nhận danh tính khách hàng.";

function previewIdentity(): ZaloIdentity | null {
  if (import.meta.env.VITE_ZALO_PREVIEW !== "true") {
    return null;
  }

  return {
    accessToken: "preview-access-token",
    zaloUserId: "preview-zalo-user",
    name: "Khách xem trước",
  };
}

export async function getZaloAccessToken(): Promise<string> {
  const preview = previewIdentity();
  if (preview) {
    return preview.accessToken;
  }

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

export async function getZaloIdentity(options: ZaloIdentityOptions = {}): Promise<ZaloIdentity> {
  const preview = previewIdentity();
  if (preview) {
    return preview;
  }

  const accessToken = await getZaloAccessToken();

  try {
    const { getUserInfo } = await import("zmp-sdk/apis");
    const { userInfo } = await getUserInfo({
      autoRequestPermission: options.requestProfilePermission === true,
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
      name: "",
    };
  }
}
