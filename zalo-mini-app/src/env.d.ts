/// <reference types="vite/client" />

declare module "zmp-sdk/apis" {
  export function getUserInfo(options?: {
    autoRequestPermission?: boolean;
    avatarType?: "small" | "normal" | "large";
  }): Promise<{
    userInfo: {
      id: string;
      name: string;
      avatar?: string;
      followedOA?: boolean;
    };
  }>;

  export function getPhoneNumber(): Promise<{ token: string }>;
}

