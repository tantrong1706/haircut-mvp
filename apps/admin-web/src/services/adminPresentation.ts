import type { SystemFeatures } from "@haircut/contracts";
import type { AdminDiagnostics } from "./adminApi";

export const ADMIN_FEATURE_LABELS: Record<
  keyof Pick<
    SystemFeatures,
    | "checkinEnabled"
    | "luckyWheelEnabled"
    | "rewardRedeemEnabled"
    | "photoUploadEnabled"
    | "pointApprovalEnabled"
    | "maintenanceMode"
  >,
  string
> = {
  checkinEnabled: "Khách check-in",
  luckyWheelEnabled: "Vòng quay",
  rewardRedeemEnabled: "Đổi mã quà",
  photoUploadEnabled: "Tải ảnh kiểu tóc",
  pointApprovalEnabled: "Gửi và duyệt điểm",
  maintenanceMode: "Chế độ bảo trì",
};
type Guidance = { title: string; nextStep: string };
const guidance: Record<string, Guidance> = {
  CUSTOMER_COUNT_MISMATCH: {
    title: "Bộ đếm khách cần đồng bộ",
    nextStep:
      "Đối chiếu số hồ sơ thực tế với bộ đếm đang lưu. Xem trước thay đổi; thao tác này không sửa điểm hoặc hồ sơ khách.",
  },
  OWNER_UNAVAILABLE: {
    title: "Kiểm tra tài khoản chủ salon",
    nextStep:
      "Đối chiếu chủ salon, trạng thái tài khoản và quyền thuộc đúng salon. Cần điều tra tài khoản riêng; không tự cấp hoặc đổi quyền tại đây.",
  },
  NO_ACTIVE_BRANCH: {
    title: "Chưa có chi nhánh hoạt động",
    nextStep:
      "Nhờ chủ salon kiểm tra chi nhánh và QR đang sử dụng. Công cụ đồng bộ bộ đếm không khắc phục được lỗi chi nhánh.",
  },
  SALON_INACTIVE: {
    title: "Đối chiếu trạng thái salon",
    nextStep:
      "Xác minh vì sao salon đang khóa hoặc chờ xóa trước khi xử lý. Không dùng công cụ sửa dữ liệu để tự mở lại salon.",
  },
  MAINTENANCE_MODE: {
    title: "Salon đang ở chế độ bảo trì",
    nextStep:
      "Đối chiếu cấu hình bảo trì với lần thay đổi gần nhất. Trang này chỉ đọc cấu hình, không tự bật lại các thao tác ghi.",
  },
  INVALID_SESSION_POINTER: {
    title: "Liên kết lượt cần điều tra riêng",
    nextStep:
      "Đối chiếu định danh salon và liên kết lượt trong nhật ký. Không xóa lượt, sửa điểm hoặc gộp khách để chữa lỗi định danh.",
  },
  STALE_SESSION_POINTER: {
    title: "Có liên kết tới lượt cũ",
    nextStep:
      "Chọn đúng liên kết trong danh sách được máy chủ cho phép bên dưới. Chỉ gỡ liên kết, giữ nguyên lịch sử, điểm và thời gian chống cộng lặp.",
  },
};
function featureLabel(code: string) {
  return Object.entries(ADMIN_FEATURE_LABELS).find(
    ([key]) => code === `FEATURE_DISABLED_${key}`,
  )?.[1];
}
function knownIssue(code: string) {
  return Object.prototype.hasOwnProperty.call(guidance, code) || Boolean(featureLabel(code));
}
export function issueGuidance(code: string): Guidance {
  if (Object.prototype.hasOwnProperty.call(guidance, code)) return guidance[code];
  const label = featureLabel(code);
  if (label)
    return {
      title: `${label} đang tắt`,
      nextStep:
        "Đối chiếu cấu hình hệ thống và cấu hình salon trước khi thay đổi. Không dùng công cụ sửa bộ đếm để mở tính năng đang bị tắt.",
    };
  return {
    title: "Cần kiểm tra chuyên sâu",
    nextStep:
      "Ghi nhận thời điểm và mã lỗi được hiển thị, mở nhật ký backend để đối chiếu. Chưa có thao tác sửa an toàn cho trường hợp này.",
  };
}
export function diagnosticSummary(data: AdminDiagnostics) {
  if (data.issues.some((issue) => issue.severity === "error"))
    return { tone: "error", title: "Cần xử lý quyền hoặc cấu hình" } as const;
  if (data.issues.length || data.stalePointers.length)
    return { tone: "warning", title: "Có dữ liệu cần đối chiếu" } as const;
  if (data.pointerScan.hasMore) return { tone: "warning", title: "Kiểm tra chưa đầy đủ" } as const;
  return { tone: "success", title: "Chưa thấy bất thường" } as const;
}
function count(value: number | null) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : "Không xác định";
}
export function formatDiagnosticReport(data: AdminDiagnostics) {
  const date = new Date(data.checkedAtMs);
  const id = /^[a-zA-Z0-9_-]{1,128}$/.test(data.salonId) ? data.salonId : "Không xác định";
  return [
    "CH Hair — Báo cáo kiểm tra salon",
    `Mã salon: ${id}`,
    `Thời điểm (UTC): ${Number.isNaN(date.getTime()) ? "Không xác định" : date.toISOString()}`,
    `Bộ đếm / hồ sơ khách thực tế: ${count(data.customerCount.stored)} / ${count(data.customerCount.actual)}`,
    `Chi nhánh hoạt động: ${count(data.activeBranches)}`,
    `Liên kết đã kiểm tra: ${count(data.pointerScan.checked)}; còn ngoài phạm vi: ${data.pointerScan.hasMore ? "có" : "không"}`,
    `Liên kết lượt cũ: ${data.stalePointers.length}`,
    `Mã kiểm tra: ${data.issues.map((issue) => (knownIssue(issue.code) ? issue.code : "UNCLASSIFIED_ISSUE")).join(", ") || "Không phát hiện trong phạm vi đã kiểm tra"}`,
    "Không chứa thông tin khách, ảnh, token hoặc mã quà. Kết quả kiểm tra không phải xác nhận đã sửa.",
  ].join("\n");
}
export function auditActionLabel(action: string) {
  if (action === "admin.support.reconcile_customer_count") return "Đồng bộ bộ đếm khách";
  if (action === "admin.support.clear_stale_session_pointer") return "Gỡ liên kết lượt cũ";
  return "Thao tác quản trị";
}
