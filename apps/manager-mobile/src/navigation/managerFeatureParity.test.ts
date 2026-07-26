import { describe, expect, it } from "vitest";
import {
  MANAGER_FEATURE_PLACEMENTS,
  OWNER_PRIMARY_TABS,
  STAFF_PRIMARY_TABS,
} from "./managerNavigation";

const REQUIRED_OWNER_FEATURES = [
  "owner.overview",
  "owner.branch_filter",
  "owner.queue",
  "owner.active_sessions",
  "owner.pending_sessions",
  "owner.completed_sessions",
  "owner.cancelled_sessions",
  "owner.no_show",
  "owner.customer_search",
  "owner.customer_profile",
  "owner.customer_points",
  "owner.point_history",
  "owner.haircut_history",
  "owner.haircut_notes",
  "owner.haircut_photos",
  "owner.customer_rewards",
  "owner.reward_history",
  "owner.customer_branch_history",
  "owner.customer_staff_history",
  "owner.customer_delete",
  "owner.point_requests",
  "owner.approval_photos",
  "owner.approve_points",
  "owner.reject_points",
  "owner.approval_history",
  "owner.branches",
  "owner.staff",
  "owner.salon_qr",
  "owner.branch_qr",
  "owner.qr_actions",
  "owner.legacy_migration",
  "owner.point_config",
  "owner.wheel_config",
  "owner.rewards",
  "owner.reward_redeem",
  "owner.reports",
  "owner.audit_permission",
  "owner.salon_profile",
  "owner.salon_branding",
  "owner.personal_avatar",
  "owner.account",
  "owner.password_reset",
  "owner.notifications",
  "owner.biometric",
  "owner.support",
  "owner.privacy",
  "owner.terms",
  "owner.salon_deletion",
  "owner.sign_out",
] as const;

const REQUIRED_STAFF_FEATURES = [
  "staff.branch_context",
  "staff.queue",
  "staff.claim",
  "staff.active_session",
  "staff.notes",
  "staff.photos",
  "staff.complete_session",
  "staff.no_show",
  "staff.cancel_session",
  "staff.submit_points",
  "staff.point_status",
  "staff.reward_redeem",
  "staff.reward_history",
  "staff.history",
  "staff.account",
  "staff.password_reset",
  "staff.notifications",
  "staff.biometric",
  "staff.support",
  "staff.privacy",
  "staff.terms",
  "staff.personal_deletion",
  "staff.sign_out",
] as const;

const REQUIRED_SHARED_FEATURES = [
  "shared.authentication",
  "shared.offline",
  "shared.app_check",
  "shared.deep_link",
  "shared.feature_flags",
  "shared.role_denied",
  "shared.retry",
  "shared.reward_scanner",
  "shared.push_notifications",
] as const;

describe("Manager navigation registry architecture", () => {
  it("không bỏ sót hoặc khai báo trùng chức năng đã kiểm kê", () => {
    const ids = MANAGER_FEATURE_PLACEMENTS.map((feature) => feature.id);
    const required = [
      ...REQUIRED_OWNER_FEATURES,
      ...REQUIRED_STAFF_FEATURES,
      ...REQUIRED_SHARED_FEATURES,
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...required].sort());
  });

  it("mọi chức năng Owner có vị trí trong đúng năm tab và tối đa ba thao tác", () => {
    const ownerTabs = new Set(OWNER_PRIMARY_TABS.map((tab) => tab.id));
    for (const id of REQUIRED_OWNER_FEATURES) {
      const feature = MANAGER_FEATURE_PLACEMENTS.find((item) => item.id === id);
      expect(feature?.owner).toBeDefined();
      expect(ownerTabs.has(feature?.owner?.tab as never)).toBe(true);
      expect(feature?.owner?.taps).toBeGreaterThanOrEqual(1);
      expect(feature?.owner?.taps).toBeLessThanOrEqual(3);
    }
  });

  it("mọi chức năng Staff có vị trí trong đúng năm tab và tối đa ba thao tác", () => {
    const staffTabs = new Set(STAFF_PRIMARY_TABS.map((tab) => tab.id));
    for (const id of REQUIRED_STAFF_FEATURES) {
      const feature = MANAGER_FEATURE_PLACEMENTS.find((item) => item.id === id);
      expect(feature?.staff).toBeDefined();
      expect(staffTabs.has(feature?.staff?.tab as never)).toBe(true);
      expect(feature?.staff?.taps).toBeGreaterThanOrEqual(1);
      expect(feature?.staff?.taps).toBeLessThanOrEqual(3);
    }
  });

  it("giữ phân quyền và feature flag trong hợp đồng giao diện", () => {
    const byId = new Map(MANAGER_FEATURE_PLACEMENTS.map((feature) => [feature.id, feature]));
    expect(byId.get("staff.reward_redeem")?.visibility).toBe("role");
    expect(byId.get("owner.audit_permission")?.visibility).toBe("role");
    expect(byId.get("shared.feature_flags")?.visibility).toBe("feature-flag");
    expect(byId.get("shared.app_check")?.visibility).toBe("background");
  });
});
