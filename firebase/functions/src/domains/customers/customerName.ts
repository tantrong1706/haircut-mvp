import { Timestamp, type DocumentData, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertSalonIsOperational } from "../../authz/authorization";
import { buildNameSearchPrefixes, normalizeSearchText } from "../../customerSearch";
import { canUserAccessBranch } from "../../security";
import { auditEventData } from "../audit/auditEvent";

function id(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9_-]{1,128}$/iu.test(value))
    throw new HttpsError("invalid-argument", "Mã hồ sơ hoặc lượt phục vụ không hợp lệ.");
  return value;
}
export function normalizedCustomerName(value: unknown) {
  if (typeof value !== "string" || /\p{Cc}/u.test(value))
    throw new HttpsError("invalid-argument", "Tên khách không hợp lệ.");
  const name = value.trim().normalize("NFC").replace(/ +/gu, " ");
  if (!name || name.length > 80)
    throw new HttpsError("invalid-argument", "Tên khách cần từ 1 đến 80 ký tự.");
  return name;
}
function belongs(data: DocumentData | undefined, salonId: string, customerId: string) {
  return data?.salonId === salonId && data.customerId === customerId;
}
function pending(data: DocumentData | undefined) {
  return data?.status === "pending" && data.approvalMode === "staff_confirmation";
}

// uid and activeRef come from the authenticated wrapper, not request.data.
export async function changeCustomerName(db: Firestore, input: {
  uid: string; salonId: string; customerId: string; name: unknown; expectedName: unknown;
  pointRequestId?: unknown; activeRef: DocumentReference;
}) {
  const salonId = id(input.salonId);
  const customerId = id(input.customerId);
  const name = normalizedCustomerName(input.name);
  if (typeof input.expectedName !== "string" || input.expectedName.length > 200)
    throw new HttpsError("invalid-argument", "Cần tải lại tên khách trước khi lưu.");
  const explicitRequest = input.pointRequestId === undefined ? "" : id(input.pointRequestId);
  const customerRef = db.doc(`customers/${customerId}`);
  const auditRef = db.collection("audit_events").doc();
  await db.runTransaction(async tx => {
    const [customerSnap, memberSnap, salonSnap, activeSnap] = await Promise.all([
      tx.get(customerRef), tx.get(db.doc(`users/${input.uid}`)),
      tx.get(db.doc(`salons/${salonId}`)), tx.get(input.activeRef),
    ]);
    const member = memberSnap.data();
    const customer = customerSnap.data();
    if (!member || String(member.salonId || "").trim() !== salonId || member.isActive !== true ||
        !["owner", "staff"].includes(member.role) || (member.role === "staff" && member.inviteStatus === "pending"))
      throw new HttpsError("permission-denied", "Tài khoản không còn quyền với salon này.");
    if (!salonSnap.exists) throw new HttpsError("not-found", "Không tìm thấy salon.");
    assertSalonIsOperational(salonSnap.data());
    if (!customer || customer.salonId !== salonId)
      throw new HttpsError("not-found", "Không tìm thấy khách trong salon này.");
    if (member.role === "staff" && !explicitRequest)
      throw new HttpsError("permission-denied", "Nhân viên chỉ sửa tên khi xử lý yêu cầu tích điểm đang chờ.");
    const currentName = String(customer.name || "");
    if (currentName !== input.expectedName && currentName !== name)
      throw new HttpsError("failed-precondition", "Tên khách đã thay đổi. Hãy tải lại và kiểm tra trước khi lưu.", { errorCode: "CUSTOMER_NAME_CHANGED" });

    let pointRef: DocumentReference | undefined;
    let point: DocumentData | undefined;
    let sessionRef: DocumentReference | undefined;
    let session: DocumentData | undefined;
    if (explicitRequest) {
      pointRef = db.doc(`point_requests/${explicitRequest}`);
      point = (await tx.get(pointRef)).data();
      if (!belongs(point, salonId, customerId))
        throw new HttpsError("permission-denied", "Yêu cầu không thuộc khách trong salon này.");
      if (!pending(point)) throw new HttpsError("failed-precondition", "Yêu cầu tích điểm không còn chờ xác nhận.");
      const branchId = id(point!.branchId);
      if (!canUserAccessBranch({ ...member, role: member.role }, branchId))
        throw new HttpsError("permission-denied", "Không được phân công tại chi nhánh này.");
      const branch = (await tx.get(db.doc(`branches/${branchId}`))).data();
      if (!branch || branch.salonId !== salonId || branch.isActive === false)
        throw new HttpsError("failed-precondition", "Chi nhánh không còn hoạt động.");
      const expiresAt = point!.expiresAt;
      if (expiresAt && typeof expiresAt.toMillis === "function" && expiresAt.toMillis() <= Date.now())
        throw new HttpsError("failed-precondition", "Yêu cầu tích điểm đã hết hạn.");
      sessionRef = db.doc(`chair_sessions/${id(point!.sessionId || explicitRequest)}`);
      session = (await tx.get(sessionRef)).data();
      if (!belongs(session, salonId, customerId) || session!.branchId !== branchId || session!.status !== "pending_approval")
        throw new HttpsError("failed-precondition", "Lượt phục vụ không còn chờ xác nhận.");
    } else {
      const active = activeSnap.data();
      const sessionId = belongs(active, salonId, customerId) ? active!.sessionId : customer.activeSessionId;
      if (typeof sessionId === "string" && /^[a-z0-9_-]{1,128}$/iu.test(sessionId)) {
        sessionRef = db.doc(`chair_sessions/${sessionId}`);
        session = (await tx.get(sessionRef)).data();
        const requestId = session?.pointRequestId || active?.pointRequestId || sessionId;
        if (typeof requestId === "string" && /^[a-z0-9_-]{1,128}$/iu.test(requestId)) {
          pointRef = db.doc(`point_requests/${requestId}`);
          point = (await tx.get(pointRef)).data();
        }
      }
    }
    if (currentName === name) return;
    const now = Timestamp.now();
    tx.update(customerRef, { name, nameSearch: normalizeSearchText(name), namePrefixes: buildNameSearchPrefixes(name), updatedAt: now });
    if (pointRef && belongs(point, salonId, customerId) && pending(point))
      tx.update(pointRef, { customerSummary: { ...(point!.customerSummary || {}), name }, updatedAt: now });
    if (sessionRef && belongs(session, salonId, customerId) && ["waiting", "serving", "pending_approval"].includes(session!.status))
      tx.update(sessionRef, { customerSummary: { ...(session!.customerSummary || {}), name }, updatedAt: now });
    tx.create(auditRef, auditEventData({ salonId, actorId: input.uid, actorRole: member.role,
      branchId: explicitRequest ? String(point!.branchId) : null,
      action: "customer.name_updated", targetType: "customer", targetId: customerId, createdAt: now }));
  });
  return { customerId, name };
}
