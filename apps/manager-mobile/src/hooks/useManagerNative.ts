import { createContext, useContext } from "react";
import type { PushInitializationStatus } from "../optionalPush";

export type ManagerNativeState = {
  nativeReady: boolean;
  online: boolean;
  biometricEnabled: boolean;
  scanning: boolean;
  pushStatus: "idle" | "initializing" | PushInitializationStatus;
  scanReward: () => Promise<void>;
  toggleBiometric: () => Promise<void>;
  retryPush: () => void;
};

export const ManagerNativeContext = createContext<ManagerNativeState>({
  nativeReady: false,
  online: true,
  biometricEnabled: false,
  scanning: false,
  pushStatus: "idle",
  scanReward: async () => undefined,
  toggleBiometric: async () => undefined,
  retryPush: () => undefined,
});

export function useManagerNative() {
  return useContext(ManagerNativeContext);
}
