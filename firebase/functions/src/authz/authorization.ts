import {
  ApiErrorCode,
  SalonStatusSchema,
  type AppRole,
  type SalonStatus,
} from "@haircut/contracts";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { auditEventData } from "../domains/audit/auditEvent";
import { canUserAccessBranch } from "../security";
import { apiError } from "../shared/errors";

export type UserRole = Extract<AppRole, "owner" | "staff">;

export type AppUser = {
  uid: string;
  salonId: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  canRedeemRewards?: boolean;
  inviteStatus?: "pending" | "accepted";
  branchId?: string;
  branchIds?: string[];
};

export type SystemAdminUser = {
  uid: string;
  name: string;
  role: "system_admin";
  isActive: boolean;
};

export function createAuthorization(db: Firestore) {
  async function getAppUser(uid: string): Promise<AppUser> {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.data() as Partial<AppUser> | undefined;
    if (!snap.exists || !data) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Không tìm thấy hồ sơ phân quyền",
      );
    }
    if (data.isActive !== true) {
      throw apiError("permission-denied", ApiErrorCode.USER_INACTIVE, "Tài khoản đã bị tắt");
    }
    if (
      (data.role !== "owner" && data.role !== "staff") ||
      typeof data.salonId !== "string" ||
      !data.salonId.trim()
    ) {
      throw apiError("permission-denied", ApiErrorCode.FORBIDDEN, "Hồ sơ phân quyền không hợp lệ");
    }

    const user: AppUser = {
      ...data,
      uid,
      salonId: data.salonId.trim(),
      name: String(data.name || "Người dùng"),
      role: data.role,
      isActive: true,
    };
    return user;
  }

  function assertAcceptedStaffInvite(user: AppUser) {
    if (user.role === "staff" && user.inviteStatus === "pending") {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Hãy xác nhận lời mời nhân viên trước khi sử dụng salon",
      );
    }
  }

  async function assertSystemAdmin(uid: string): Promise<SystemAdminUser> {
    const snap = await db.collection("users").doc(uid).get();
    const user = snap.data() as Partial<SystemAdminUser> | undefined;
    if (!snap.exists || user?.role !== "system_admin" || user.isActive !== true) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Bạn không có quyền quản trị hệ thống",
      );
    }
    return {
      uid,
      name: String(user.name || "Quản trị viên"),
      role: "system_admin",
      isActive: true,
    };
  }

  async function assertSalonRole(
    uid: string,
    requestedSalonId: string,
    allowedRoles: UserRole[],
  ): Promise<AppUser> {
    const user = await getAppUser(uid);
    if (user.salonId !== requestedSalonId) {
      await recordSecurityEvent({
        user,
        action: "salon.cross_tenant_access_blocked",
        targetType: "salon",
        targetId: requestedSalonId,
        metadata: { reason: "salon_mismatch" },
      });
      throw apiError("permission-denied", ApiErrorCode.FORBIDDEN, "Không có quyền với salon này");
    }
    if (!allowedRoles.includes(user.role)) {
      throw apiError(
        "permission-denied",
        ApiErrorCode.FORBIDDEN,
        "Vai trò hiện tại không được phép thực hiện thao tác này",
      );
    }
    assertAcceptedStaffInvite(user);
    const salonSnap = await db.collection("salons").doc(user.salonId).get();
    if (!salonSnap.exists) {
      throw apiError("not-found", ApiErrorCode.INVALID_SALON, "Không tìm thấy salon của tài khoản");
    }
    assertSalonIsOperational(salonSnap.data());
    return user;
  }

  async function assertSalonRoleIncludingInactiveSalon(
    uid: string,
    requestedSalonId: string,
    allowedRoles: UserRole[],
  ) {
    const user = await getAppUser(uid);
    if (user.salonId !== requestedSalonId || !allowedRoles.includes(user.role)) {
      throw apiError("permission-denied", ApiErrorCode.FORBIDDEN, "Không có quyền với salon này");
    }
    assertAcceptedStaffInvite(user);
    return user;
  }

  async function assertBranchAccess(user: AppUser, branchId: string) {
    if (canUserAccessBranch(user, branchId)) return;
    await recordSecurityEvent({
      user,
      branchId,
      action: "staff.branch_access_denied",
      targetType: "branch",
      targetId: branchId,
      metadata: { reason: "branch_not_assigned" },
    });
    throw apiError(
      "permission-denied",
      ApiErrorCode.BRANCH_ACCESS_DENIED,
      "Bạn không được phân công tại chi nhánh này",
      { branchId },
    );
  }

  function assertBranchIsOperational(
    branch: DocumentData | undefined,
    salonId: string,
    branchId: string,
  ) {
    if (!branch || branch.salonId !== salonId || branch.isActive === false) {
      throw apiError(
        "failed-precondition",
        ApiErrorCode.INVALID_BRANCH,
        "Chi nhánh không tồn tại hoặc đã bị khóa",
        { branchId },
      );
    }
  }

  async function recordSecurityEvent(input: {
    user: AppUser;
    branchId?: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      await db.collection("audit_events").add(
        auditEventData({
          salonId: input.user.salonId,
          branchId: input.branchId,
          actorId: input.user.uid,
          actorRole: input.user.role,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          metadata: input.metadata,
        }),
      );
    } catch {
      console.warn("Không ghi được audit bảo mật", {
        salonId: input.user.salonId,
        userId: input.user.uid,
        errorCode: "AUDIT_WRITE_FAILED",
      });
    }
  }

  return {
    assertBranchAccess,
    assertBranchIsOperational,
    assertSalonRole,
    assertSalonRoleIncludingInactiveSalon,
    assertSystemAdmin,
    getAppUser,
  };
}

export function salonStatus(data: DocumentData | undefined): SalonStatus {
  const parsed = SalonStatusSchema.safeParse(data?.status);
  if (parsed.success) return parsed.data;
  return data?.isActive === false ? "suspended" : "active";
}

export function assertSalonIsOperational(data: DocumentData | undefined) {
  const status = salonStatus(data);
  if (status === "suspended") {
    throw apiError("failed-precondition", ApiErrorCode.SALON_SUSPENDED, "Salon đang tạm khóa");
  }
  if (status === "pending_deletion") {
    throw apiError(
      "failed-precondition",
      ApiErrorCode.SALON_PENDING_DELETION,
      "Salon đang chờ xóa dữ liệu",
    );
  }
}
