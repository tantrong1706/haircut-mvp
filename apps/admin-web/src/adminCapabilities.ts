export type AdminTab = "overview" | "salons" | "features" | "audit";

export const ADMIN_WRITE_ACTIONS_ENABLED = false;

export const READ_ONLY_ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "salons", label: "Salon" },
  { id: "features", label: "Cấu hình" },
  { id: "audit", label: "Nhật ký" },
];
