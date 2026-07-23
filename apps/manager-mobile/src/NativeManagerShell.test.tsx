import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeManagerShell } from "./NativeManagerShell";
import { useManagerNative } from "./hooks/useManagerNative";
import { createSingleFlight } from "./managerBootstrap";
import { createPushInitializationSingleFlight } from "./optionalPush";
import type { AppUser } from "./services/managerApi";

const runtime = vi.hoisted(() => ({
  biometricLockEnabled: vi.fn(),
  disableBiometricLock: vi.fn(),
  enableBiometricLock: vi.fn(),
  initializeNativeManager: vi.fn(),
  initializePushNotifications: vi.fn(),
  managerRuntimeUserKey: vi.fn((user: AppUser) => `${user.uid}:${user.salonId}`),
  retryBiometricUnlock: vi.fn(),
  safelyHideSplashScreen: vi.fn(),
  scanRewardCode: vi.fn(),
}));

vi.mock("./nativeRuntime", () => runtime);
vi.mock("./services/monitoring", () => ({ captureError: vi.fn(), trackEvent: vi.fn() }));

describe("NativeManagerShell attempt ownership", () => {
  beforeEach(() => {
    runtime.biometricLockEnabled.mockResolvedValue(false);
    runtime.safelyHideSplashScreen.mockResolvedValue(true);
  });

  it("chi cap nhat Push tu attempt cua tai khoan hien tai", async () => {
    const pushA = deferred<{ status: "ready"; cleanup: () => void }>();
    const pushB = deferred<{ status: "ready"; cleanup: () => void }>();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();
    const startNative = createSingleFlight(
      async (input: { onNativeReady: (ready: boolean) => void }) => {
        input.onNativeReady(true);
        return vi.fn();
      },
      {
        cleanup: (cleanup) => cleanup(),
      },
    );
    const startPush = createPushInitializationSingleFlight((key) =>
      key === "owner-a:salon-1" ? pushA.promise : pushB.promise,
    );

    runtime.initializeNativeManager.mockImplementation((input: { user: AppUser }) =>
      startNative(
        runtime.managerRuntimeUserKey(input.user),
        input as { user: AppUser; onNativeReady: (ready: boolean) => void },
      ),
    );
    runtime.initializePushNotifications.mockImplementation((user: AppUser) =>
      startPush(runtime.managerRuntimeUserKey(user)),
    );

    const accountA = appUser("owner-a");
    const accountB = appUser("owner-b");
    const view = render(
      <NativeManagerShell user={accountA}>
        <PushState />
      </NativeManagerShell>,
    );

    await waitFor(() => expect(runtime.initializePushNotifications).toHaveBeenCalledTimes(1));
    expect(screen.getByText("push:initializing")).toBeInTheDocument();

    view.rerender(
      <NativeManagerShell user={accountB}>
        <PushState />
      </NativeManagerShell>,
    );
    await waitFor(() => expect(runtime.initializePushNotifications).toHaveBeenCalledTimes(2));

    pushA.resolve({ status: "ready", cleanup: cleanupA });
    await waitFor(() => expect(cleanupA).toHaveBeenCalledOnce());
    expect(screen.getByText("push:initializing")).toBeInTheDocument();
    expect(cleanupB).not.toHaveBeenCalled();

    pushB.resolve({ status: "ready", cleanup: cleanupB });
    await waitFor(() => expect(screen.getByText("push:ready")).toBeInTheDocument());
    expect(cleanupB).not.toHaveBeenCalled();

    view.unmount();
    await waitFor(() => expect(cleanupB).toHaveBeenCalledOnce());
  });
});

function PushState() {
  const { pushStatus } = useManagerNative();
  return <span>{`push:${pushStatus}`}</span>;
}

function appUser(uid: string): AppUser {
  return {
    uid,
    salonId: "salon-1",
    name: uid,
    avatarUrl: "",
    role: "owner",
    isActive: true,
    branchIds: ["branch-1"],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
