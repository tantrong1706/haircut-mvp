export type BiometricUnlockResult =
  | { ok: true }
  | {
      ok: false;
      code: "BIOMETRIC_CANCELLED" | "BIOMETRIC_UNAVAILABLE" | "BIOMETRIC_FAILED";
      message: string;
    };

export async function runBiometricUnlock(input: {
  check: () => Promise<{ isAvailable: boolean; deviceIsSecure: boolean }>;
  authenticate: () => Promise<void>;
}): Promise<BiometricUnlockResult> {
  try {
    const capability = await input.check();
    if (!capability.isAvailable && !capability.deviceIsSecure) {
      return {
        ok: false,
        code: "BIOMETRIC_UNAVAILABLE",
        message: "Thiết bị chưa có sinh trắc học hoặc mã khóa màn hình.",
      };
    }
    await input.authenticate();
    return { ok: true };
  } catch (error) {
    const code = biometricErrorCode(error);
    return {
      ok: false,
      code,
      message:
        code === "BIOMETRIC_CANCELLED"
          ? "Bạn đã hủy xác thực. Hãy thử lại để tiếp tục."
          : code === "BIOMETRIC_UNAVAILABLE"
            ? "Thiết bị chưa hỗ trợ phương thức mở khóa đã chọn."
            : "Chưa thể xác thực thiết bị. Hãy thử lại bằng sinh trắc học hoặc mã khóa.",
    };
  }
}

export function createBiometricUnlockSingleFlight(
  unlock: () => Promise<BiometricUnlockResult>,
) {
  let inFlight: Promise<BiometricUnlockResult> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = unlock().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

function biometricErrorCode(
  error: unknown,
): "BIOMETRIC_CANCELLED" | "BIOMETRIC_UNAVAILABLE" | "BIOMETRIC_FAILED" {
  const record = error as { code?: unknown; message?: unknown };
  const value = `${String(record?.code || "")} ${String(record?.message || "")}`.toLowerCase();
  if (/cancel|canceled|cancelled|user.*dismiss|user.*fallback/.test(value)) {
    return "BIOMETRIC_CANCELLED";
  }
  if (/not.*available|not.*supported|unavailable|no.*biometr|passcode.*not.*set/.test(value)) {
    return "BIOMETRIC_UNAVAILABLE";
  }
  return "BIOMETRIC_FAILED";
}
