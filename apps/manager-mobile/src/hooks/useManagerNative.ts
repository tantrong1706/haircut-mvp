import { createContext, useContext } from "react";

export type ManagerNativeState = {
  nativeReady: boolean;
  online: boolean;
  biometricEnabled: boolean;
  scanning: boolean;
  scanReward: () => Promise<void>;
  toggleBiometric: () => Promise<void>;
};

export const ManagerNativeContext = createContext<ManagerNativeState>({
  nativeReady: false,
  online: true,
  biometricEnabled: false,
  scanning: false,
  scanReward: async () => undefined,
  toggleBiometric: async () => undefined,
});

export function useManagerNative() {
  return useContext(ManagerNativeContext);
}
