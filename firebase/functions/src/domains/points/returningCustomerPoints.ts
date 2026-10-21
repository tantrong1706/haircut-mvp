import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertSalonIsOperational, createAuthorization } from "../../authz/authorization";
import { pointCooldownRemainingMs } from "../../businessRules";
import { canUserAccessBranch } from "../../security";
import { auditEventData } from "../audit/auditEvent";

const COOLDOWN_MS = 2 * 60 * 60_000;
const DAILY_STAFF_LIMIT = 100;
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const millis = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;
type Request = { auth?: { uid: string } | null; data?: unknown };

/** Staff-only, selected customer ID is authoritative; a phone suffix is never an identity. */
export function createReturningCustomerPointAward(
  db: Firestore,
  dependencies: {
    rateLimit: (uid: string, salonId: string) => Promise<void>;
    featureCheck: (salonId: string, appVersion: unknown) => Promise<unknown>;
  },
) {
  const authz = createAuthorization(db);
  return async (request: Request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Vui lòng đăng nhập tài khoản nhân viên.");
    const data = request.data as Record<string, unknown> | null;
    if (
      !data ||
      !validId(data.salonId) ||
      !validId(data.branchId) ||
      !validId(data.customerId) ||
      typeof data.phoneLast4 !== "string" ||
      !/^\d{4}$/.test(data.phoneLast4) ||
      typeof data.operationId !== "string" ||
      !/^[A-Za-z0-9_-]{16,80}$/.test(data.operationId)
    ) {
      throw new HttpsError("invalid-argument", "Thông tin khách hoặc lượt cộng điểm không hợp lệ.");
    }
    const { salonId, branchId, customerId, phoneLast4, operationId } = data;
    const user = await authz.assertSalonRole(uid, salonId, ["owner", "staff"]);
    await authz.assertBranchAccess(user, branchId);
    if (user.role !== "owner" && user.canAwardPointsDirectly !== true) {
      throw new HttpsError(
        "permission-denied",
        "Chủ salon cần cấp quyền cộng điểm trực tiếp cho tài khoản này.",
      );
    }
    await dependencies.rateLimit(uid, salonId);
    await dependencies.featureCheck(salonId, data.appVersion);
    const requestId = `returning-${hash(`${salonId}:${uid}:${operationId}`)}`;
    const pointRef = db.doc(`point_requests/${requestId}`);
    const customerRef = db.doc(`customers/${customerId}`);
    const activeRef = db.doc(
      `active_service_sessions/${hash(`${salonId}:${customerId}`).slice(0, 40)}`,
    );
    const recordRef = db.doc(`haircut_records/${hash(`haircut-record:${requestId}`)}`);
    const now = Timestamp.now();
    const dateKey = new Date(now.toMillis() + 7 * 60 * 60_000).toISOString().slice(0, 10);
    const counterRef = db.doc(`staff_daily_point_awards/${hash(`${salonId}:${uid}:${dateKey}`)}`);

    return db.runTransaction(async (tx) => {
      const [actorSnap, salonSnap, branchSnap, customerSnap, pointSnap, activeSnap, counterSnap] =
        await Promise.all([
          tx.get(db.doc(`users/${uid}`)),
          tx.get(db.doc(`salons/${salonId}`)),
          tx.get(db.doc(`branches/${branchId}`)),
          tx.get(customerRef),
          tx.get(pointRef),
          tx.get(activeRef),
          tx.get(counterRef),
        ]);
      // Read permissions in the same transaction as the balance: revocation races retry safely.
      const actor = actorSnap.data();
      if (
        !actor ||
        actor.salonId !== salonId ||
        actor.isActive !== true ||
        !["owner", "staff"].includes(actor.role) ||
        actor.inviteStatus === "pending" ||
        (actor.role === "staff" && actor.canAwardPointsDirectly !== true) ||
        !canUserAccessBranch(
          { role: actor.role, branchId: actor.branchId, branchIds: actor.branchIds },
          branchId,
        )
      ) {
        throw new HttpsError(
          "permission-denied",
          "Bạn không có quyền cộng điểm tại chi nhánh này.",
        );
      }
      if (!salonSnap.exists) throw new HttpsError("not-found", "Không tìm thấy salon.");
      assertSalonIsOperational(salonSnap.data());
      authz.assertBranchIsOperational(branchSnap.data(), salonId, branchId);
      const prior = pointSnap.data();
      if (prior) {
        if (
          prior.source !== "staff_phone_lookup" ||
          prior.customerId !== customerId ||
          prior.salonId !== salonId ||
          prior.branchId !== branchId ||
          prior.staffId !== uid ||
          prior.status !== "approved"
        ) {
          throw new HttpsError("failed-precondition", "Mã thao tác đã được dùng cho lượt khác.");
        }
        return {
          requestId,
          alreadyProcessed: true,
          pointsAdded: Number(prior.pointsAdded),
          pointsAfter: Number(prior.pointsAfter),
        };
      }
      const customer = customerSnap.data();
      if (!customer || customer.salonId !== salonId)
        throw new HttpsError("not-found", "Không tìm thấy khách trong salon.");
      if (customer.phoneLast4 !== phoneLast4)
        throw new HttpsError(
          "failed-precondition",
          "Thông tin khách đã thay đổi. Vui lòng tìm lại.",
        );
      if (
        pointCooldownRemainingMs({
          nowMs: now.toMillis(),
          lastVisitAtMs: millis(customer.lastVisitAt),
          nextEligibleAtMs: millis(customer.nextPointEligibleAt),
          cooldownMs: COOLDOWN_MS,
        }) > 0
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Khách vừa được tích điểm. Chưa thể cộng thêm lượt mới.",
          { errorCode: "POINT_COOLDOWN" },
        );
      }
      // Do not supersede a QR request or its photos. Staff must finish that existing visit.
      if (activeSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Khách đang có lượt chờ xử lý. Hãy xác nhận trong danh sách khách hiện tại.",
          { errorCode: "ACTIVE_SESSION_EXISTS" },
        );
      }
      const pointsAdded = Number(salonSnap.data()?.pointPerVisit ?? 1);
      const pointsBefore = Number(customer.points ?? 0);
      if (
        !Number.isSafeInteger(pointsAdded) ||
        pointsAdded < 1 ||
        !Number.isSafeInteger(pointsBefore) ||
        pointsBefore < 0 ||
        !Number.isSafeInteger(pointsBefore + pointsAdded)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Cấu hình điểm chưa hợp lệ. Vui lòng báo chủ salon.",
        );
      }
      const awards = Number(counterSnap.data()?.awards ?? 0);
      if (
        actor.role === "staff" &&
        (!Number.isSafeInteger(awards) || awards >= DAILY_STAFF_LIMIT || awards < 0)
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "Đã đạt hạn mức cộng trực tiếp hôm nay. Vui lòng báo chủ salon.",
        );
      }
      const pointsAfter = pointsBefore + pointsAdded;
      const staffName = String(actor.name || "Nhân viên");
      const branchName = String(branchSnap.data()?.name || "Chi nhánh");
      const approvalMode = actor.role === "owner" ? "owner_direct" : "staff_direct";
      const common = {
        salonId,
        branchId,
        branchName,
        customerId,
        staffId: uid,
        staffName,
        source: "staff_phone_lookup",
        approvalMode,
        note: "",
        photoUrls: [],
        photoPaths: [],
        createdAt: now,
      };
      tx.update(customerRef, {
        points: pointsAfter,
        lastVisitAt: now,
        nextPointEligibleAt: Timestamp.fromMillis(now.toMillis() + COOLDOWN_MS),
        updatedAt: now,
      });
      tx.create(pointRef, {
        ...common,
        sessionId: requestId,
        status: "approved",
        pointsRequested: pointsAdded,
        pointsAdded,
        pointsBefore,
        pointsAfter,
        idempotencyKey: requestId,
        approvedBy: uid,
        approvedAt: now,
        processedBy: uid,
        processedAt: now,
        updatedAt: now,
        customerSummary: {
          name: String(customer.name || "Khách hàng"),
          phoneLast4,
          points: pointsBefore,
          allowPhoto: customer.allowPhoto === true,
        },
      });
      tx.create(db.doc(`chair_sessions/${requestId}`), {
        ...common,
        status: "completed",
        isOpen: false,
        assignedStaffId: uid,
        assignedStaffName: staffName,
        completedAt: now,
        updatedAt: now,
      });
      tx.create(recordRef, { ...common, pointRequestId: requestId, pointsAdded, approvedBy: uid });
      if (actor.role === "staff")
        tx.set(
          counterRef,
          {
            salonId,
            staffId: uid,
            dateKey,
            awards: awards + 1,
            pointsAwarded: Number(counterSnap.data()?.pointsAwarded ?? 0) + pointsAdded,
            updatedAt: now,
          },
          { merge: true },
        );
      tx.create(
        db.collection("audit_events").doc(),
        auditEventData({
          salonId,
          branchId,
          actorId: uid,
          actorRole: actor.role,
          action: "point_request.returning_customer_awarded",
          targetType: "point_request",
          targetId: requestId,
          requestId,
          before: { points: pointsBefore },
          after: { points: pointsAfter, pointsAdded },
          createdAt: now,
        }),
      );
      return { requestId, alreadyProcessed: false, pointsAdded, pointsAfter };
    });
  };
}
