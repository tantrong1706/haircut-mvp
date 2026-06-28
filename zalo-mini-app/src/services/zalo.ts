import { getPhoneNumber, getUserInfo } from "zmp-sdk/apis";

export type ZaloIdentity = {
  zaloUserId: string;
  name: string;
  avatar?: string;
};

export async function getZaloIdentity(): Promise<ZaloIdentity> {
  try {
    const { userInfo } = await getUserInfo({
      autoRequestPermission: true,
      avatarType: "normal",
    });
    return {
      zaloUserId: userInfo.id,
      name: userInfo.name,
      avatar: userInfo.avatar,
    };
  } catch {
    return {
      zaloUserId: "mock-zalo-user",
      name: "Nguyễn Văn A",
    };
  }
}

export async function requestPhoneToken(): Promise<string | null> {
  try {
    const { token } = await getPhoneNumber();
    return token;
  } catch {
    return null;
  }
}
