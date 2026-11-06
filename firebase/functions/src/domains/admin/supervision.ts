import { createHash } from "node:crypto";
import { FieldPath, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createAuthorization, salonStatus } from "../../authz/authorization";
import { auditEventData } from "../audit/auditEvent";

type Request = { auth?: { uid: string; token?: Record<string, unknown> } | null; data?: unknown };
type Action = "suspend_salon" | "reactivate_salon" | "cancel_point_request";
const writesEnabled = () => process.env.ADMIN_SUPERVISION_WRITES_ENABLED === "true";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpsError("invalid-argument", "Thông tin quản trị không hợp lệ");
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
    throw new HttpsError("invalid-argument", "Mã định danh không hợp lệ");
  return value;
}
function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    throw new HttpsError("invalid-argument", "Tên xác nhận hoặc lý do không hợp lệ");
  return value.trim();
}
function millis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
function consistent(
  requestId: string,
  row: DocumentData,
  session: DocumentData | undefined,
  salonId: string,
) {
  return (
    row.salonId === salonId &&
    row.sessionId === requestId &&
    typeof row.customerId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(row.customerId) &&
    typeof row.branchId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(row.branchId) &&
    session?.salonId === salonId &&
    session.customerId === row.customerId &&
    session.branchId === row.branchId &&
    session.status === "pending_approval" &&
    session.isOpen === true
  );
}
function parseManagement(value: unknown) {
  const data = object(value);
  if (!["suspend_salon", "reactivate_salon", "cancel_point_request"].includes(String(data.action)))
    throw new HttpsError("invalid-argument", "Thao tác quản trị không được hỗ trợ");
  if (!["active", "suspended", "pending_deletion"].includes(String(data.expectedStatus)))
    throw new HttpsError("invalid-argument", "Trạng thái đối chiếu không hợp lệ");
  const operationId = id(data.operationId);
  if (operationId.length < 16) throw new HttpsError("invalid-argument", "Mã thao tác quá ngắn");
  return {
    salonId: id(data.salonId),
    action: data.action as Action,
    expectedStatus: String(data.expectedStatus),
    operationId,
    confirmedSalonName: text(data.confirmedSalonName, 1, 200),
    reason: text(data.reason, 10, 300),
    ...(data.action === "cancel_point_request" ? { requestId: id(data.requestId) } : {}),
  };
}

export function createAdminSupervision(
  db: Firestore,
  rateLimit: (uid: string, mode: "read" | "repair") => Promise<void>,
) {
  const { assertSystemAdmin } = createAuthorization(db);
  async function authorize(request: Request) {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Bạn cần đăng nhập quản trị");
    await assertSystemAdmin(request.auth.uid);
    return request.auth.uid;
  }
  async function operations(request: Request) {
    const uid = await authorize(request),
      data = object(request.data),
      salonId = id(data.salonId);
    const size = data.pageSize ?? 50;
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > 50)
      throw new HttpsError("invalid-argument", "Số yêu cầu mỗi trang không hợp lệ");
    const cursor = data.cursor === undefined ? undefined : id(data.cursor);
    await rateLimit(uid, "read");
    const salon = await db.doc(`salons/${salonId}`).get();
    if (!salon.exists) throw new HttpsError("not-found", "Không tìm thấy salon");
    const base = db
      .collection("point_requests")
      .where("salonId", "==", salonId)
      .where("status", "==", "pending");
    let query = base.orderBy(FieldPath.documentId()).limit(size + 1);
    if (cursor) {
      const previous = await db.doc(`point_requests/${cursor}`).get();
      if (!previous.exists || previous.data()?.salonId !== salonId)
        throw new HttpsError("invalid-argument", "Mốc phân trang không thuộc salon");
      query = query.startAfter(cursor);
    }
    const [page, count] = await Promise.all([query.get(), base.count().get()]);
    const rows = page.docs.slice(0, size);
    const sessions = rows.length
      ? await db.getAll(...rows.map((row) => db.doc(`chair_sessions/${row.id}`)))
      : [];
    const sessionMap = new Map(sessions.map((row) => [row.id, row.data()]));
    const now = Date.now(),
      status = salonStatus(salon.data());
    return {
      salonId,
      salonName: String(salon.data()?.name || "Salon"),
      status,
      checkedAtMs: now,
      writesEnabled: writesEnabled(),
      totalPending: count.data().count,
      requests: rows.map((row) => {
        const value = row.data(),
          valid = consistent(row.id, value, sessionMap.get(row.id), salonId);
        const expiresAtMs = millis(value.expiresAt);
        return {
          id: row.id,
          sessionId: row.id,
          branchId: typeof value.branchId === "string" ? value.branchId : "",
          branchName:
            typeof value.branchName === "string"
              ? value.branchName.slice(0, 200)
              : "Chưa rõ chi nhánh",
          createdAtMs: millis(value.createdAt),
          expiresAtMs,
          state: !valid
            ? "inconsistent"
            : expiresAtMs === null
              ? "unknown"
              : expiresAtMs <= now
                ? "expired"
                : "waiting",
          cancellable: valid && status !== "pending_deletion",
        };
      }),
      nextCursor: page.size > size ? rows[rows.length - 1]!.id : null,
    };
  }
  async function manage(request: Request) {
    const uid = await authorize(request);
    if (!writesEnabled())
      throw new HttpsError("failed-precondition", "Thao tác quản trị mới chưa được bật", {
        errorCode: "ADMIN_SUPERVISION_DISABLED",
      });
    const age = Date.now() - Number(request.auth?.token?.auth_time ?? 0) * 1000;
    if (!Number.isFinite(age) || age > 600_000 || age < -60_000)
      throw new HttpsError("failed-precondition", "Hãy đăng nhập lại trước khi thay đổi", {
        errorCode: "RECENT_LOGIN_REQUIRED",
      });
    const input = parseManagement(request.data);
    await rateLimit(uid, "repair");
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const receiptRef = db.doc(
      `admin_supervision_operations/${createHash("sha256").update(`${uid}:${input.operationId}`).digest("hex")}`,
    );
    const salonRef = db.doc(`salons/${input.salonId}`),
      auditRef = db.collection("audit_events").doc();
    return db.runTransaction(async (tx) => {
      const [profile, grant, receipt, salon] = await tx.getAll(
        db.doc(`users/${uid}`),
        db.doc(`system_admin_access/${uid}`),
        receiptRef,
        salonRef,
      );
      if (
        ![profile.data(), grant.data()].some(
          (row) => row?.role === "system_admin" && row.isActive === true,
        )
      )
        throw new HttpsError("permission-denied", "Quyền quản trị đã bị thu hồi");
      if (receipt.exists) {
        if (receipt.data()?.fingerprint !== fingerprint)
          throw new HttpsError("already-exists", "Mã thao tác đã được dùng cho nội dung khác");
        return receipt.data()!.result;
      }
      if (!salon.exists) throw new HttpsError("not-found", "Không tìm thấy salon");
      const currentStatus = salonStatus(salon.data()),
        now = Timestamp.now();
      if (
        currentStatus === "pending_deletion" ||
        currentStatus !== input.expectedStatus ||
        String(salon.data()?.name || "Salon").trim() !== input.confirmedSalonName
      )
        throw new HttpsError("failed-precondition", "Salon đã thay đổi hoặc xác nhận không khớp", {
          errorCode: "ADMIN_PREVIEW_STALE",
        });
      let changed = false,
        status = currentStatus;
      let before: Record<string, unknown>, after: Record<string, unknown>;
      if (input.action === "cancel_point_request") {
        const requestRef = db.doc(`point_requests/${input.requestId}`),
          sessionRef = db.doc(`chair_sessions/${input.requestId}`);
        const [point, session] = await tx.getAll(requestRef, sessionRef);
        const row = point.data();
        if (
          !row ||
          row.status !== "pending" ||
          !consistent(input.requestId!, row, session.data(), input.salonId)
        )
          throw new HttpsError(
            "failed-precondition",
            "Yêu cầu đã xử lý hoặc không khớp salon/lượt cắt",
            { errorCode: "ADMIN_PREVIEW_STALE" },
          );
        const pointerId = createHash("sha256")
          .update(`${input.salonId}:${row.customerId}`)
          .digest("hex")
          .slice(0, 40);
        const pointerRef = db.doc(`active_service_sessions/${pointerId}`),
          pointer = await tx.get(pointerRef);
        before = { requestStatus: "pending", sessionStatus: "pending_approval" };
        after = { requestStatus: "rejected", sessionStatus: "cancelled" };
        tx.update(requestRef, {
          status: "rejected",
          rejectedBy: uid,
          rejectedAt: now,
          processedBy: uid,
          processedAt: now,
          rejectionReason: "admin",
          updatedAt: now,
        });
        tx.update(sessionRef, {
          status: "cancelled",
          isOpen: false,
          cancellationReason: "admin",
          cancelledBy: uid,
          cancelledAt: now,
          updatedAt: now,
        });
        if (
          pointer.data()?.salonId === input.salonId &&
          pointer.data()?.customerId === row.customerId &&
          pointer.data()?.sessionId === input.requestId
        )
          tx.delete(pointerRef);
        changed = true;
      } else {
        status = input.action === "suspend_salon" ? "suspended" : "active";
        before = { status: currentStatus };
        after = { status };
        changed = status !== currentStatus;
        if (changed)
          tx.update(salonRef, {
            status,
            isActive: status === "active",
            statusReason: input.reason,
            statusUpdatedBy: uid,
            statusUpdatedAt: now,
            updatedAt: now,
          });
      }
      const result = {
        changed,
        salonId: input.salonId,
        action: input.action,
        operationId: input.operationId,
        status,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      };
      if (changed)
        tx.set(
          auditRef,
          auditEventData({
            salonId: input.salonId,
            actorId: uid,
            actorRole: "system_admin",
            action: `admin.supervision.${input.action}`,
            targetType: input.requestId ? "point_request" : "salon",
            targetId: input.requestId || input.salonId,
            requestId: input.operationId,
            before,
            after,
            metadata: { reason: input.reason },
            createdAt: now,
          }),
        );
      tx.set(receiptRef, {
        actorId: uid,
        salonId: input.salonId,
        fingerprint,
        result,
        createdAt: now,
      });
      return result;
    });
  }
  return { operations, manage };
}
