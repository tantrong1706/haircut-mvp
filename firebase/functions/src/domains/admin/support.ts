import { createHash } from "node:crypto";
import { normalizeSystemFeatures } from "@haircut/contracts";
import { FieldPath, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createAuthorization, salonStatus } from "../../authz/authorization";
import { auditEventData } from "../audit/auditEvent";

type Request = {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  data?: unknown;
};
type RepairAction = "reconcile_customer_count" | "clear_stale_session_pointer";
type Issue = {
  code: string;
  severity: "warning" | "error";
  message: string;
  action: RepairAction | null;
};
type RepairInput = {
  salonId: string;
  action: RepairAction;
  operationId: string;
  reason: string;
  confirmedSalonName: string;
  expectedStoredCount?: number | null;
  expectedActualCount?: number;
  pointerId?: string;
  expectedSessionId?: string;
};

const enabled = () => process.env.ADMIN_SUPPORT_REPAIRS_ENABLED === "true";
const pointerKey = (salonId: string, customerId: string) =>
  createHash("sha256").update(`${salonId}:${customerId}`).digest("hex").slice(0, 40);
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const countValue = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpsError("invalid-argument", "Thông tin thao tác không hợp lệ");
  return value as Record<string, unknown>;
}
function id(value: unknown, label: string) {
  if (!validId(value)) throw new HttpsError("invalid-argument", `${label} không hợp lệ`);
  return value;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    throw new HttpsError("invalid-argument", `${label} không hợp lệ`);
  return value.trim();
}
function parseRepair(value: unknown): RepairInput {
  const data = object(value);
  const action = data.action;
  if (action !== "reconcile_customer_count" && action !== "clear_stale_session_pointer")
    throw new HttpsError("invalid-argument", "Thao tác sửa không được hỗ trợ");
  const input: RepairInput = {
    salonId: id(data.salonId, "Salon"),
    action,
    operationId: id(data.operationId, "Mã thao tác"),
    reason: text(data.reason, "Lý do", 10, 300),
    confirmedSalonName: text(data.confirmedSalonName, "Tên salon xác nhận", 1, 200),
  };
  if (input.operationId.length < 16)
    throw new HttpsError("invalid-argument", "Mã thao tác quá ngắn");
  if (action === "reconcile_customer_count") {
    if (
      (data.expectedStoredCount !== null && countValue(data.expectedStoredCount) === null) ||
      countValue(data.expectedActualCount) === null
    )
      throw new HttpsError("invalid-argument", "Số khách đối chiếu không hợp lệ");
    input.expectedStoredCount = data.expectedStoredCount as number | null;
    input.expectedActualCount = data.expectedActualCount as number;
  } else {
    input.pointerId = id(data.pointerId, "Liên kết lượt");
    if (!/^[a-f0-9]{40}$/.test(input.pointerId))
      throw new HttpsError("invalid-argument", "Liên kết lượt không hợp lệ");
    input.expectedSessionId = id(data.expectedSessionId, "Lượt cắt");
  }
  return input;
}

function pointerMatches(pointerId: string, pointer: DocumentData, salonId: string) {
  return (
    pointer.salonId === salonId &&
    validId(pointer.customerId) &&
    validId(pointer.sessionId) &&
    pointerId === pointerKey(salonId, pointer.customerId)
  );
}
function closedOrMissingSession(session: DocumentData | undefined, pointer: DocumentData) {
  return (
    !session ||
    (session.salonId === pointer.salonId &&
      session.customerId === pointer.customerId &&
      session.isOpen === false &&
      ["completed", "cancelled"].includes(session.status))
  );
}

export function createAdminSupport(
  db: Firestore,
  rateLimit: (uid: string, mode: "read" | "repair") => Promise<void>,
) {
  const { assertSystemAdmin } = createAuthorization(db);
  async function authorize(request: Request) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Bạn cần đăng nhập quản trị");
    await assertSystemAdmin(uid);
    return uid;
  }
  async function access(request: Request) {
    await authorize(request);
    return { authorized: true, repairsEnabled: enabled() };
  }
  async function diagnose(request: Request) {
    const uid = await authorize(request);
    const salonId = id(object(request.data).salonId, "Salon");
    await rateLimit(uid, "read");
    const salonSnap = await db.doc(`salons/${salonId}`).get();
    if (!salonSnap.exists) throw new HttpsError("not-found", "Không tìm thấy salon");
    const salon = salonSnap.data()!;
    const [
      customerCount,
      branches,
      disabledBranches,
      owner,
      globalFeatures,
      localFeatures,
      pointers,
    ] = await Promise.all([
      db.collection("customers").where("salonId", "==", salonId).count().get(),
      db.collection("branches").where("salonId", "==", salonId).count().get(),
      db
        .collection("branches")
        .where("salonId", "==", salonId)
        .where("isActive", "==", false)
        .count()
        .get(),
      validId(salon.ownerId) ? db.doc(`users/${salon.ownerId}`).get() : Promise.resolve(null),
      db.doc("system_config/features").get(),
      db.doc(`salons/${salonId}/settings/features`).get(),
      db
        .collection("active_service_sessions")
        .where("salonId", "==", salonId)
        .orderBy(FieldPath.documentId())
        .limit(51)
        .get(),
    ]);
    const actual = customerCount.data().count;
    const stored = countValue(salon.customerCount);
    const activeBranches = branches.data().count - disabledBranches.data().count;
    const features = normalizeSystemFeatures(globalFeatures.data(), localFeatures.data());
    const issues: Issue[] = [];
    const add = (
      code: string,
      message: string,
      action: RepairAction | null = null,
      severity: Issue["severity"] = "warning",
    ) => issues.push({ code, message, action, severity });
    if (stored !== actual)
      add(
        "CUSTOMER_COUNT_MISMATCH",
        "Bộ đếm khách không khớp số hồ sơ thực tế.",
        "reconcile_customer_count",
      );
    const ownerData = owner?.data();
    if (
      !ownerData ||
      ownerData.role !== "owner" ||
      ownerData.isActive !== true ||
      ownerData.salonId !== salonId
    )
      add(
        "OWNER_UNAVAILABLE",
        "Thiếu chủ salon hoạt động đúng quyền. Cần kiểm tra tài khoản; không tự cấp quyền.",
        null,
        "error",
      );
    if (activeBranches === 0)
      add("NO_ACTIVE_BRANCH", "Chưa có chi nhánh hoạt động. Chủ salon cần cấu hình chi nhánh.");
    if (salonStatus(salon) !== "active")
      add(
        "SALON_INACTIVE",
        "Salon đang khóa hoặc chờ xóa. Không tự mở lại bằng công cụ sửa dữ liệu.",
        null,
        "error",
      );
    if (features.maintenanceMode)
      add("MAINTENANCE_MODE", "Chế độ bảo trì đang bật; kiểm tra cấu hình trước khi xử lý.");
    for (const key of [
      "checkinEnabled",
      "pointApprovalEnabled",
      "luckyWheelEnabled",
      "rewardRedeemEnabled",
      "photoUploadEnabled",
    ] as const) {
      if (!features[key])
        add(`FEATURE_DISABLED_${key}`, `Tính năng ${key} đang được cấu hình tắt.`);
    }
    const sample = pointers.docs.slice(0, 50);
    const stalePointers: Array<{ pointerId: string; sessionId: string; customerId: string }> = [];
    if (sample.length) {
      const ids = [...new Set(sample.map((row) => row.data().sessionId).filter(validId))];
      const sessions = ids.length
        ? await db.getAll(...ids.map((value) => db.doc(`chair_sessions/${value}`)))
        : [];
      const requests = ids.length
        ? await db.getAll(...ids.map((value) => db.doc(`point_requests/${value}`)))
        : [];
      const sessionMap = new Map(sessions.map((row) => [row.id, row.data()]));
      const requestMap = new Map(requests.map((row) => [row.id, row.data()]));
      for (const row of sample) {
        const pointer = row.data();
        if (!pointerMatches(row.id, pointer, salonId)) {
          add(
            "INVALID_SESSION_POINTER",
            "Có liên kết lượt thiếu thông tin hoặc sai định danh; cần kiểm tra riêng.",
            null,
            "error",
          );
          continue;
        }
        if (
          closedOrMissingSession(sessionMap.get(pointer.sessionId), pointer) &&
          requestMap.get(pointer.sessionId)?.status !== "pending"
        )
          stalePointers.push({
            pointerId: row.id,
            sessionId: pointer.sessionId,
            customerId: pointer.customerId,
          });
      }
    }
    if (stalePointers.length)
      add(
        "STALE_SESSION_POINTER",
        "Có liên kết lượt đã kết thúc hoặc không còn tồn tại.",
        "clear_stale_session_pointer",
      );
    return {
      salonId,
      salonName: String(salon.name || "Salon"),
      status: salonStatus(salon),
      checkedAtMs: Date.now(),
      repairsEnabled: enabled(),
      customerCount: { stored, actual },
      activeBranches,
      features,
      issues,
      stalePointers,
      pointerScan: { checked: sample.length, hasMore: pointers.size > 50 },
    };
  }
  async function repair(request: Request) {
    const uid = await authorize(request);
    if (!enabled())
      throw new HttpsError(
        "failed-precondition",
        "Chức năng sửa hỗ trợ chưa được bật trên máy chủ",
        { errorCode: "ADMIN_SUPPORT_REPAIRS_DISABLED" },
      );
    const age = Date.now() - Number(request.auth?.token?.auth_time ?? 0) * 1000;
    if (!Number.isFinite(age) || age > 10 * 60_000 || age < -60_000)
      throw new HttpsError("failed-precondition", "Hãy đăng nhập lại trước khi sửa dữ liệu", {
        errorCode: "RECENT_LOGIN_REQUIRED",
      });
    const input = parseRepair(request.data);
    await rateLimit(uid, "repair");
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const operationKey = createHash("sha256").update(`${uid}:${input.operationId}`).digest("hex");
    const operationRef = db.doc(`admin_support_operations/${operationKey}`);
    const salonRef = db.doc(`salons/${input.salonId}`);
    const auditRef = db.collection("audit_events").doc();
    return db.runTransaction(async (tx) => {
      const [profile, membership, receipt, salonSnap] = await tx.getAll(
        db.doc(`users/${uid}`),
        db.doc(`system_admin_access/${uid}`),
        operationRef,
        salonRef,
      );
      const allowed = [profile.data(), membership.data()].some(
        (row) => row?.role === "system_admin" && row.isActive === true,
      );
      if (!allowed) throw new HttpsError("permission-denied", "Quyền quản trị đã bị thu hồi");
      if (receipt.exists) {
        if (receipt.data()?.fingerprint !== fingerprint)
          throw new HttpsError("already-exists", "Mã thao tác đã dùng cho yêu cầu khác");
        return receipt.data()!.result;
      }
      if (!salonSnap.exists) throw new HttpsError("not-found", "Không tìm thấy salon");
      const salon = salonSnap.data()!;
      if (salonStatus(salon) === "pending_deletion")
        throw new HttpsError("failed-precondition", "Không sửa salon đang chờ xóa");
      if (input.confirmedSalonName !== String(salon.name || "Salon").trim())
        throw new HttpsError("failed-precondition", "Tên salon xác nhận không khớp");
      let before: Record<string, unknown>;
      let after: Record<string, unknown>;
      let changed = false;
      const now = Timestamp.now();
      if (input.action === "reconcile_customer_count") {
        const actual = (
          await tx.get(db.collection("customers").where("salonId", "==", input.salonId).count())
        ).data().count;
        const stored = countValue(salon.customerCount);
        if (stored !== input.expectedStoredCount || actual !== input.expectedActualCount)
          throw new HttpsError(
            "failed-precondition",
            "Dữ liệu đã thay đổi. Hãy kiểm tra lại trước khi sửa.",
            { errorCode: "ADMIN_PREVIEW_STALE" },
          );
        before = { customerCount: stored };
        after = { customerCount: actual };
        changed = stored !== actual;
        if (changed) tx.update(salonRef, { customerCount: actual, updatedAt: now });
      } else {
        const pointerRef = db.doc(`active_service_sessions/${input.pointerId}`);
        const pointerSnap = await tx.get(pointerRef);
        before = { pointerId: input.pointerId, sessionId: input.expectedSessionId };
        after = { pointerRemoved: true };
        if (pointerSnap.exists) {
          const pointer = pointerSnap.data()!;
          if (
            !pointerMatches(pointerSnap.id, pointer, input.salonId) ||
            pointer.sessionId !== input.expectedSessionId
          )
            throw new HttpsError("failed-precondition", "Liên kết lượt đã thay đổi hoặc sai salon");
          const [session, pending] = await tx.getAll(
            db.doc(`chair_sessions/${pointer.sessionId}`),
            db.doc(`point_requests/${pointer.sessionId}`),
          );
          if (
            !closedOrMissingSession(session.data(), pointer) ||
            pending.data()?.status === "pending"
          )
            throw new HttpsError(
              "failed-precondition",
              "Lượt còn hoạt động, đang chờ duyệt hoặc sai dữ liệu. Không được gỡ liên kết.",
            );
          tx.delete(pointerRef);
          changed = true;
        }
      }
      const result = {
        salonId: input.salonId,
        action: input.action,
        changed,
        operationId: input.operationId,
      };
      if (changed)
        tx.set(
          auditRef,
          auditEventData({
            salonId: input.salonId,
            actorId: uid,
            actorRole: "system_admin",
            action: `admin.support.${input.action}`,
            targetType: "salon_support",
            targetId: input.pointerId || input.salonId,
            requestId: input.operationId,
            before,
            after,
            metadata: { reason: input.reason },
            createdAt: now,
          }),
        );
      tx.set(operationRef, {
        actorId: uid,
        salonId: input.salonId,
        fingerprint,
        result,
        createdAt: now,
      });
      return result;
    });
  }
  return { access, diagnose, repair };
}
