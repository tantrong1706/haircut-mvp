import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { languageCode: "" },
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock("./firebase", () => ({
  callFunction: vi.fn(),
  getFirebaseAuth: () => mocks.auth,
  getFirebaseDb: vi.fn(),
  getFirebaseStorage: vi.fn(),
  isFirebaseConfigured: () => true,
}));

vi.mock("./functionWrites", () => ({
  callWriteFunctionOrFallback: vi.fn(),
}));

import { requestOwnerStaffPasswordReset } from "./auth";

describe("requestOwnerStaffPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.languageCode = "";
    mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it("chuẩn hóa email và gửi liên kết chứa mã xác minh qua Firebase Auth", async () => {
    await requestOwnerStaffPasswordReset("  Owner@Haircut.vn ");

    expect(mocks.auth.languageCode).toBe("vi");
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(mocks.auth, "owner@haircut.vn");
  });

  it("không gửi khi email sai định dạng", async () => {
    await expect(requestOwnerStaffPasswordReset("email-khong-hop-le")).rejects.toThrow(
      "Vui lòng nhập email hợp lệ",
    );
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
