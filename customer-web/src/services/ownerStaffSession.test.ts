import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { name: "owner-staff-auth" },
  setPersistence: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), createUser: vi.fn(),
}));
vi.mock("firebase/auth", async (original) => ({
  ...await original<typeof import("firebase/auth")>(),
  setPersistence: mocks.setPersistence,
  signInWithEmailAndPassword: mocks.signIn,
  signOut: mocks.signOut,
  createUserWithEmailAndPassword: mocks.createUser,
}));
vi.mock("./firebase", () => ({ getFirebaseAuth: () => mocks.auth, getFirebaseDb: () => null, getFirebaseStorage: () => null, isFirebaseConfigured: () => true, callFunction: vi.fn() }));
import { browserLocalPersistence } from "firebase/auth";
import { registerOwnerSalon, signInOwnerStaff, signOutOwnerStaff } from "./auth";

describe("owner and staff remembered sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.signIn.mockResolvedValue({ user: {} });
    mocks.createUser.mockRejectedValue({ code: "auth/network-request-failed" });
    delete window.__haircutBeforeSignOut;
  });
  it("waits for local persistence before signing in either salon role", async () => {
    let finish!: () => void;
    mocks.setPersistence.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const pending = signInOwnerStaff("staff@example.test", "fixture-only");
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, browserLocalPersistence);
    expect(mocks.signIn).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(mocks.signIn).toHaveBeenCalledWith(mocks.auth, "staff@example.test", "fixture-only");
  });
  it("does not silently promise persistence when browser storage is blocked; retry works", async () => {
    mocks.setPersistence.mockRejectedValueOnce({ code: "auth/web-storage-unsupported" });
    await expect(signInOwnerStaff("owner@example.test", "fixture-only")).rejects.toThrow(/lưu phiên đăng nhập/);
    expect(mocks.signIn).not.toHaveBeenCalled();
    await signInOwnerStaff("owner@example.test", "fixture-only");
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });
  it("prepares persistence before new owner registration too", async () => {
    await expect(registerOwnerSalon({ email: "owner@example.test", password: "FixtureOnly1", ownerName: "Owner", salonName: "Demo" })).rejects.toThrow();
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, browserLocalPersistence);
    expect(mocks.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.createUser.mock.invocationCallOrder[0]);
  });
  it("explicit logout clears only owner/staff auth after pending work is settled", async () => {
    const beforeSignOut = vi.fn().mockResolvedValue(undefined);
    window.__haircutBeforeSignOut = beforeSignOut;
    await signOutOwnerStaff();
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth);
    expect(beforeSignOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
  });
});
