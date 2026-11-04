import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { customerIdForWeb } from "../../customerWebIdentity";
import { assertSalonIsOperational } from "../../authz/authorization";
import { buildNameSearchPrefixes, normalizeSearchText } from "../../customerSearch";
import { auditEventData } from "../audit/auditEvent";
import { normalizedCustomerName } from "./customerName";

export async function changeOwnCustomerName(
  db: Firestore,
  input: {
    uid: string;
    salonId: string;
    name: unknown;
    expectedName: unknown;
    activeRef: DocumentReference;
  },
) {
  const { uid, salonId } = input;
  if (!/^[a-z0-9_-]{1,128}$/iu.test(salonId))
    throw new HttpsError("invalid-argument", "Mã salon không hợp lệ.");
  const name = normalizedCustomerName(input.name);
  if (typeof input.expectedName !== "string" || input.expectedName.length > 200)
    throw new HttpsError("invalid-argument", "Cần tải lại tên trước khi lưu.");
  // Identity is derived exclusively from the verified Phone Auth principal.
  const customerId = customerIdForWeb(salonId, uid);
  const customerRef = db.doc(`customers/${customerId}`);
  const auditRef = db.collection("audit_events").doc();
  await db.runTransaction(async (tx) => {
    const [customerSnap, salonSnap, activeSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(db.doc(`salons/${salonId}`)),
      tx.get(input.activeRef),
    ]);
    const customer = customerSnap.data();
    if (!customer || customer.salonId !== salonId || customer.firebaseUid !== uid)
      throw new HttpsError("permission-denied", "Không xác minh được hồ sơ thuộc tài khoản này.");
    if (!salonSnap.exists || salonSnap.data()?.isActive === false)
      throw new HttpsError("failed-precondition", "Salon không còn hoạt động.");
    assertSalonIsOperational(salonSnap.data());
    if (customer.name !== input.expectedName && customer.name !== name)
      throw new HttpsError("failed-precondition", "Tên đã thay đổi. Hãy tải lại trước khi lưu.", {
        errorCode: "CUSTOMER_NAME_CHANGED",
      });
    const active = activeSnap.data();
    const candidate =
      active?.salonId === salonId && active.customerId === customerId
        ? active.sessionId
        : customer.activeSessionId;
    const sessionId =
      typeof candidate === "string" && /^[a-z0-9_-]{1,128}$/iu.test(candidate) ? candidate : "";
    const related = sessionId
      ? await Promise.all([
          tx.get(db.doc(`chair_sessions/${sessionId}`)),
          tx.get(db.doc(`point_requests/${sessionId}`)),
        ])
      : [];
    if (customer.name === name) return;
    const now = Timestamp.now();
    tx.update(customerRef, {
      name,
      nameSearch: normalizeSearchText(name),
      namePrefixes: buildNameSearchPrefixes(name),
      updatedAt: now,
    });
    for (const record of related) {
      const data = record.data();
      if (!data || data.salonId !== salonId || data.customerId !== customerId) continue;
      const open =
        record.ref.parent.id === "point_requests"
          ? data.status === "pending"
          : ["waiting", "serving", "pending_approval"].includes(data.status);
      if (!open) continue;
      const summary =
        data.customerSummary &&
        typeof data.customerSummary === "object" &&
        !Array.isArray(data.customerSummary)
          ? data.customerSummary
          : {};
      tx.update(record.ref, { customerSummary: { ...summary, name }, updatedAt: now });
    }
    tx.create(
      auditRef,
      auditEventData({
        salonId,
        actorId: uid,
        actorRole: "customer",
        action: "customer.name_updated",
        targetType: "customer",
        targetId: customerId,
        createdAt: now,
      }),
    );
  });
  return { customerId, name };
}
