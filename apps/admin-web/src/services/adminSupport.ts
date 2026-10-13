import type { AdminDiagnostics, AdminRepairInput, RepairAction } from "./adminApi";

export function adminErrorMessage(error: unknown): string {
  const value = error as {
    code?: unknown;
    message?: unknown;
    details?: { errorCode?: unknown };
  } | null;
  const code = String(value?.code || value?.message || "").replace(/^functions\//, "");
  const detail = value?.details?.errorCode;
  if (detail === "RECENT_LOGIN_REQUIRED")
    return "Phiên xác nhận đã cũ. Hãy đăng xuất và đăng nhập lại trước khi sửa.";
  if (detail === "ADMIN_PREVIEW_STALE")
    return "Dữ liệu vừa thay đổi. Bấm kiểm tra lại để đối chiếu trước khi sửa.";
  if (detail === "ADMIN_SUPPORT_REPAIRS_DISABLED")
    return "Máy chủ chưa bật chức năng sửa hỗ trợ. Bạn vẫn có thể xem kết quả kiểm tra.";
  if (code === "permission-denied" || code === "unauthenticated")
    return "Phiên đăng nhập không có quyền quản trị hoặc quyền đã bị thu hồi. Hãy đăng nhập lại.";
  if (code === "resource-exhausted")
    return "Bạn kiểm tra quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  if (code === "already-exists")
    return "Mã thao tác đã được xử lý. Hãy kiểm tra lại trước khi tạo thao tác khác.";
  if (code === "not-found")
    return "Salon hoặc chức năng chưa có trên máy chủ. Hãy kiểm tra lại phiên bản triển khai.";
  if (code === "failed-precondition" || code === "invalid-argument")
    return "Điều kiện sửa chưa hợp lệ hoặc dữ liệu đã thay đổi. Hãy kiểm tra lại thông tin.";
  return "Chưa kết nối được dịch vụ quản trị. Hãy thử lại; nếu lỗi còn, xem mục Sự cố. Không coi dữ liệu chưa tải là số 0.";
}

export function supportLinks(projectId: string) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) return [];
  const project = encodeURIComponent(projectId);
  return [
    {
      label: "Kiểm tra Billing Google",
      href: `https://console.cloud.google.com/billing/linkedaccount?project=${project}`,
      description:
        "Khi Google báo billing disabled, cần chủ tài khoản khôi phục thanh toán. Trang này không tự thanh toán.",
    },
    {
      label: "Mở nhật ký backend",
      href: `https://console.cloud.google.com/logs/query?project=${project}`,
      description:
        "Đối chiếu thời điểm và mã lỗi. Không gửi token, số điện thoại hoặc nội dung khách hàng vào báo cáo công khai.",
    },
    {
      label: "Kiểm tra chỉ mục dữ liệu",
      href: `https://console.firebase.google.com/project/${project}/firestore/indexes`,
      description:
        "Nếu thiếu chỉ mục, cần triển khai đúng cấu hình đã kiểm thử; không tạo hoặc xóa dữ liệu để chữa lỗi.",
    },
  ];
}

export function makeRepairInput(
  diagnostics: AdminDiagnostics,
  action: RepairAction,
  reason: string,
  confirmedSalonName: string,
  operationId: string,
  pointer?: AdminDiagnostics["stalePointers"][number],
): AdminRepairInput {
  const input: AdminRepairInput = {
    salonId: diagnostics.salonId,
    action,
    reason: reason.trim(),
    confirmedSalonName: confirmedSalonName.trim(),
    operationId,
  };
  if (action === "reconcile_customer_count")
    return {
      ...input,
      expectedStoredCount: diagnostics.customerCount.stored,
      expectedActualCount: diagnostics.customerCount.actual,
    };
  if (!pointer) throw new Error("Thiếu liên kết lượt cần đối chiếu");
  return { ...input, pointerId: pointer.pointerId, expectedSessionId: pointer.sessionId };
}
