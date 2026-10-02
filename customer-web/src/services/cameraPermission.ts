export type CameraPermissionState =
  "unknown" | "checking" | "granted" | "prompt" | "denied" | "unsupported" | "unavailable";

export async function inspectCameraPermission(): Promise<CameraPermissionState> {
  if (typeof document === "undefined" || typeof navigator === "undefined") return "unavailable";
  if (typeof isSecureContext === "boolean" && !isSecureContext) return "unavailable";
  const input = document.createElement("input");
  if (!("capture" in input)) return "unavailable";
  if (!navigator.permissions?.query) return "unsupported";
  try {
    const permission = await navigator.permissions.query({ name: "camera" as PermissionName });
    return permission.state === "granted"
      ? "granted"
      : permission.state === "denied"
        ? "denied"
        : "prompt";
  } catch {
    return "unsupported";
  }
}

export function cameraPermissionMessage(state: CameraPermissionState): string {
  switch (state) {
    case "checking":
      return "Đang kiểm tra quyền camera...";
    case "denied":
      return "Camera đang bị chặn. Hãy mở cài đặt quyền của điện thoại hoặc chọn ảnh từ thư viện.";
    case "unavailable":
      return "Thiết bị hoặc trình duyệt này không mở được camera. Bạn vẫn có thể chọn ảnh từ thư viện.";
    case "unsupported":
      return "Thiết bị sẽ hỏi quyền camera khi bạn tiếp tục chụp ảnh.";
    default:
      return "";
  }
}
