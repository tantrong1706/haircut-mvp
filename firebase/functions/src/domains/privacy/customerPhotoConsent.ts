import { Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { customerIdForWeb } from "../../customerWebIdentity";

// uid is supplied by the authenticated callable wrapper, never by request.data.
export async function withdrawCustomerPhotoConsent(
  db: Firestore,
  input: { uid: string; salonId: string; activeRef: DocumentReference },
) {
  const { uid, salonId, activeRef } = input;
  const customerId = customerIdForWeb(salonId, uid);
  const ref = db.collection("customers").doc(customerId);
  await db.runTransaction(async (tx) => {
    const [snapshot, activeSnapshot] = await Promise.all([tx.get(ref), tx.get(activeRef)]);
    const customer = snapshot.data();
    if (!snapshot.exists || customer?.salonId !== salonId || customer.firebaseUid !== uid) {
      throw new HttpsError("permission-denied", "Không xác minh được hồ sơ thuộc tài khoản này.");
    }
    const active = activeSnapshot.data();
    const candidate =
      active?.salonId === salonId && active.customerId === customerId
        ? active.sessionId
        : customer.activeSessionId;
    const sessionId =
      typeof candidate === "string" && /^[a-z0-9_-]{1,128}$/iu.test(candidate) ? candidate : "";
    const related = sessionId
      ? await Promise.all([
          tx.get(db.collection("chair_sessions").doc(sessionId)),
          tx.get(db.collection("point_requests").doc(sessionId)),
        ])
      : [];
    const now = Timestamp.now();
    if (customer.allowPhoto !== false) {
      tx.update(ref, { allowPhoto: false, photoConsentRevokedAt: now, updatedAt: now });
    }
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
      tx.update(record.ref, {
        photoConsentGranted: false,
        photoConsentRevokedAt: now,
        customerSummary: { ...summary, allowPhoto: false },
        photoUrls: [],
        photoPaths: [],
        updatedAt: now,
      });
    }
  });
  return { allowPhoto: false as const };
}
