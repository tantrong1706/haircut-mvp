import {
  Timestamp,
  type DocumentData,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { normalizeSystemFeatures } from "@haircut/contracts";
import { createAuthorization, assertSalonIsOperational } from "../../authz/authorization";
import { canUserAccessBranch } from "../../security";
import { isExpectedPhotoUploadPath } from "./photoUploadOperations";

type Request = { auth?: { uid: string } | null; data?: unknown };
type Scope = {
  uid: string;
  salonId: string;
  customerId: string;
  recordId?: string;
  sessionId?: string;
};
const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const millis = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp).toMillis() : null;
const revision = (v: unknown) => (Number.isInteger(v) && Number(v) >= 0 ? Number(v) : 0);

async function context(db: Firestore, tx: Transaction, input: Scope) {
  const authz = createAuthorization(db);
  const [memberSnap, salonSnap, customerSnap] = await Promise.all([
    tx.get(db.doc(`users/${input.uid}`)),
    tx.get(db.doc(`salons/${input.salonId}`)),
    tx.get(db.doc(`customers/${input.customerId}`)),
  ]);
  const member = memberSnap.data(),
    customer = customerSnap.data();
  if (
    !member ||
    member.salonId !== input.salonId ||
    member.isActive !== true ||
    !["owner", "staff"].includes(member.role) ||
    member.inviteStatus === "pending"
  ) {
    throw new HttpsError("permission-denied", "Bạn không có quyền với hồ sơ này.");
  }
  assertSalonIsOperational(salonSnap.data());
  if (!customer || customer.salonId !== input.salonId)
    throw new HttpsError("permission-denied", "Hồ sơ không thuộc salon này.");
  const latest = await tx.get(
    db
      .collection("haircut_records")
      .where("salonId", "==", input.salonId)
      .where("customerId", "==", input.customerId)
      .orderBy("createdAt", "desc")
      .limit(1),
  );
  const snap = latest.docs[0],
    record = snap?.data();
  if (!snap || !record) throw new HttpsError("not-found", "Khách chưa có lượt cắt đã cộng điểm.");
  if (input.recordId && input.recordId !== snap.id)
    throw new HttpsError("failed-precondition", "Đã có lượt cắt mới hơn. Vui lòng mở lại hồ sơ.");
  if (!validId(record.branchId) || !canUserAccessBranch(member, record.branchId))
    throw new HttpsError("permission-denied", "Bạn không được phân công tại chi nhánh này.");
  if (!validId(record.pointRequestId))
    throw new HttpsError("failed-precondition", "Lượt cắt cũ chưa đủ thông tin để bổ sung.");
  const pointRef = db.doc(`point_requests/${record.pointRequestId}`);
  const [pointSnap, branchSnap] = await Promise.all([
    tx.get(pointRef),
    tx.get(db.doc(`branches/${record.branchId}`)),
  ]);
  authz.assertBranchIsOperational(branchSnap.data(), input.salonId, record.branchId);
  const point = pointSnap.data();
  if (
    !point ||
    point.status !== "approved" ||
    point.salonId !== input.salonId ||
    point.customerId !== input.customerId ||
    point.branchId !== record.branchId ||
    !validId(point.sessionId)
  )
    throw new HttpsError("failed-precondition", "Liên kết lượt cắt không hợp lệ.");
  const sessionRef = db.doc(`chair_sessions/${point.sessionId}`);
  const session = (await tx.get(sessionRef)).data();
  if (
    !session ||
    session.status !== "completed" ||
    session.salonId !== input.salonId ||
    session.customerId !== input.customerId ||
    session.branchId !== record.branchId ||
    (input.sessionId && input.sessionId !== point.sessionId)
  )
    throw new HttpsError("failed-precondition", "Lượt cắt không còn hợp lệ.");
  return {
    member,
    customer,
    record,
    recordRef: snap.ref,
    point,
    pointRef,
    session,
    sessionRef,
    branchId: record.branchId as string,
    sessionId: point.sessionId as string,
  };
}

function mayEdit(ctx: Awaited<ReturnType<typeof context>>, uid: string) {
  if (
    ctx.member.role !== "owner" &&
    ctx.record.staffId !== uid &&
    ctx.session.assignedStaffId !== uid
  )
    throw new HttpsError(
      "permission-denied",
      "Chỉ chủ salon hoặc nhân viên phụ trách lượt cắt được bổ sung.",
    );
}

export async function assertLatestCompletedPhotoVisit(
  db: Firestore,
  tx: Transaction,
  input: Scope,
) {
  if (!validId(input.recordId))
    throw new HttpsError("invalid-argument", "Thiếu lượt cắt cần bổ sung.");
  const ctx = await context(db, tx, input);
  mayEdit(ctx, input.uid);
  if (ctx.customer.allowPhoto !== true || ctx.session.photoConsentGranted !== true)
    throw new HttpsError("failed-precondition", "Chưa có đồng ý lưu ảnh cho lượt cắt này.");
  return ctx;
}

export function createVisitDetailsApi(
  db: Firestore,
  rateLimit: (uid: string, salonId: string) => Promise<void>,
  resolvePhotos: (
    record: DocumentData,
    scope: { salonId: string; customerId: string; sessionId: string },
  ) => Promise<string[]> = async () => [],
) {
  function parse(request: Request) {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Vui lòng đăng nhập.");
    const data = request.data as Record<string, unknown> | null;
    if (!data || Array.isArray(data) || !validId(data.salonId) || !validId(data.customerId))
      throw new HttpsError("invalid-argument", "Thông tin hồ sơ không hợp lệ.");
    return {
      data,
      scope: { uid: request.auth.uid, salonId: data.salonId, customerId: data.customerId },
    };
  }
  async function read(request: Request) {
    const { scope } = parse(request);
    await rateLimit(scope.uid, scope.salonId);
    const ctx = await db.runTransaction((tx) => context(db, tx, scope));
    mayEdit(ctx, scope.uid);
    const canView =
      ctx.customer.allowPhoto === true &&
      (ctx.session.approvalMode !== "staff_confirmation" ||
        ctx.session.photoConsentGranted === true);
    return {
      recordId: ctx.recordRef.id,
      sessionId: ctx.sessionId,
      branchId: ctx.branchId,
      createdAtMs: millis(ctx.record.createdAt),
      revision: revision(ctx.record.detailsRevision),
      note: String(ctx.record.note || ""),
      allowPhoto: ctx.customer.allowPhoto === true,
      photoConsentGranted: ctx.session.photoConsentGranted === true,
      photoCount: new Set([...list(ctx.record.photoPaths), ...list(ctx.record.photoUrls)]).size,
      photoUrls: canView
        ? await resolvePhotos(ctx.record, {
            salonId: scope.salonId,
            customerId: scope.customerId,
            sessionId: ctx.sessionId,
          })
        : [],
    };
  }
  async function update(request: Request) {
    const { data, scope } = parse(request);
    const allowed = new Set([
      "salonId",
      "customerId",
      "recordId",
      "revision",
      "note",
      "addPhotoPaths",
      "photoConsentConfirmed",
      "appVersion",
      "platform",
    ]);
    if (
      Object.keys(data).some((key) => !allowed.has(key)) ||
      !validId(data.recordId) ||
      !Number.isInteger(data.revision) ||
      Number(data.revision) < 0 ||
      (data.note !== undefined && (typeof data.note !== "string" || data.note.length > 1000)) ||
      (data.photoConsentConfirmed !== undefined && data.photoConsentConfirmed !== true) ||
      (data.addPhotoPaths !== undefined &&
        (!Array.isArray(data.addPhotoPaths) ||
          data.addPhotoPaths.length > 3 ||
          data.addPhotoPaths.some((p) => typeof p !== "string"))) ||
      (data.note === undefined &&
        data.photoConsentConfirmed === undefined &&
        data.addPhotoPaths === undefined)
    )
      throw new HttpsError("invalid-argument", "Nội dung bổ sung không hợp lệ.");
    await rateLimit(scope.uid, scope.salonId);
    return db.runTransaction(async (tx) => {
      const ctx = await context(db, tx, { ...scope, recordId: data.recordId as string });
      mayEdit(ctx, scope.uid);
      if (revision(ctx.record.detailsRevision) !== data.revision)
        throw new HttpsError("aborted", "Hồ sơ vừa được cập nhật. Đóng và mở lại trước khi lưu.");
      const [system, salonFeatures] = await Promise.all([
        tx.get(db.doc("system_config/features")),
        tx.get(db.doc(`salons/${scope.salonId}/settings/features`)),
      ]);
      const features = normalizeSystemFeatures(system.data(), salonFeatures.data());
      const additions = list(data.addPhotoPaths);
      if (features.maintenanceMode || (additions.length && !features.photoUploadEnabled))
        throw new HttpsError("failed-precondition", "Tính năng đang tạm ngừng.");
      if ((data.photoConsentConfirmed || additions.length) && ctx.customer.allowPhoto !== true)
        throw new HttpsError(
          "failed-precondition",
          "Khách chưa đồng ý hoặc đã thu hồi quyền lưu ảnh. Không thể tự bật lại tại đây.",
        );
      if (
        additions.length &&
        ctx.session.photoConsentGranted !== true &&
        data.photoConsentConfirmed !== true
      )
        throw new HttpsError(
          "failed-precondition",
          "Hãy xác nhận khách đồng ý lưu ảnh cho lượt này.",
        );
      const paths = [...new Set([...list(ctx.record.photoPaths), ...additions])];
      if (paths.length + list(ctx.record.photoUrls).length > 3)
        throw new HttpsError("failed-precondition", "Mỗi lượt tối đa 3 ảnh.");
      const operationRefs = [];
      for (const path of additions.filter((p) => !list(ctx.record.photoPaths).includes(p))) {
        const id = path.slice(path.lastIndexOf("/") + 1, -4);
        if (
          !/^op-[a-f0-9]{40}$/.test(id) ||
          !isExpectedPhotoUploadPath(path, {
            salonId: scope.salonId,
            customerId: scope.customerId,
            sessionId: ctx.sessionId,
            operationId: id,
          })
        )
          throw new HttpsError("invalid-argument", "Ảnh không thuộc lượt cắt.");
        const ref = db.doc(`photo_upload_operations/${id}`),
          op = (await tx.get(ref)).data();
        if (
          !op ||
          op.status !== "finalized" ||
          op.recordId !== ctx.recordRef.id ||
          op.salonId !== scope.salonId ||
          op.branchId !== ctx.branchId ||
          op.customerId !== scope.customerId ||
          op.sessionId !== ctx.sessionId ||
          op.staffUid !== scope.uid ||
          op.storagePath !== path ||
          op.attachmentStatus !== "unattached" ||
          (millis(op.orphanExpiresAt) ?? 0) <= Date.now()
        )
          throw new HttpsError(
            "failed-precondition",
            "Ảnh chưa hoàn tất hoặc không thuộc lượt cắt này.",
          );
        operationRefs.push(ref);
      }
      const now = Timestamp.now(),
        nextRevision = revision(ctx.record.detailsRevision) + 1;
      const patch: DocumentData = {
        detailsRevision: nextRevision,
        detailsUpdatedAt: now,
        detailsUpdatedBy: scope.uid,
      };
      if (data.note !== undefined) patch.note = String(data.note).trim();
      if (data.addPhotoPaths !== undefined) patch.photoPaths = paths;
      tx.update(ctx.recordRef, patch);
      const related: DocumentData = {};
      if (data.note !== undefined) related.note = patch.note;
      if (data.addPhotoPaths !== undefined) related.photoPaths = paths;
      if (Object.keys(related).length) tx.update(ctx.pointRef, related);
      if (data.photoConsentConfirmed === true) {
        related.photoConsentGranted = true;
        related.photoConsentConfirmedBy = scope.uid;
        related.photoConsentConfirmedAt = now;
      }
      if (Object.keys(related).length) tx.update(ctx.sessionRef, related);
      for (const ref of operationRefs)
        tx.update(ref, {
          attachmentStatus: "attached",
          attachedAt: now,
          attachedRecordId: ctx.recordRef.id,
          attachedRequestId: ctx.record.pointRequestId,
          orphanExpiresAt: null,
        });
      tx.create(db.collection("audit_events").doc(), {
        salonId: scope.salonId,
        branchId: ctx.branchId,
        actorId: scope.uid,
        actorRole: ctx.member.role,
        action: "haircut.details_updated",
        targetType: "haircut_record",
        targetId: ctx.recordRef.id,
        createdAt: now,
        metadata: {
          revision: nextRevision,
          noteChanged: data.note !== undefined,
          photosAdded: operationRefs.length,
          photoConsentConfirmed: data.photoConsentConfirmed === true,
        },
      });
      return { revision: nextRevision };
    });
  }
  return { read, update };
}
