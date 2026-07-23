import type { StaffSession } from "../../services/managerApi";

export function staffStatusLabel(status: StaffSession["status"]) {
  if (status === "pending_approval") return "Chờ duyệt";
  if (status === "serving") return "Đang phục vụ";
  if (status === "completed") return "Đã hoàn tất";
  if (status === "cancelled") return "Đã hủy";
  return "Đang chờ";
}

export function maskedPhone(session: StaffSession) {
  return session.customer?.phoneLast4 ? `******${session.customer.phoneLast4}` : "Chưa có SĐT";
}

export function sessionStatusText(session: StaffSession, currentUid: string) {
  if (session.status === "pending_approval") {
    return "Đã gửi chủ salon duyệt. Không gửi lại để tránh cộng trùng điểm.";
  }
  if (session.status === "serving") {
    return session.assignedStaffId === currentUid
      ? "Bạn đang phụ trách lượt này."
      : `${session.assignedStaffName || "Nhân viên khác"} đang phụ trách.`;
  }
  if (session.status === "completed") return "Điểm và lịch sử đã được cập nhật.";
  if (session.status === "cancelled") return "Khách cần tạo lượt mới nếu tiếp tục sử dụng.";
  return "Nhận khách trước khi bắt đầu phục vụ.";
}
