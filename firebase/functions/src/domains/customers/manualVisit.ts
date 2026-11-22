import { createHash } from "node:crypto";
import {
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { pointCooldownRemainingMs } from "../../businessRules";
import { salonOwnerSwitches } from "../salons/publicContact";
import { auditEventData } from "../audit/auditEvent";

const WINDOW_MS = 2 * 60 * 60_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : null);

/** All reads happen here; the caller invokes write only after completing its own reads. */
export async function prepareManualVisit(
  db: Firestore,
  tx: Transaction,
  input: {
    uid: string;
    role: "owner" | "staff";
    staffName: string;
    salonId: string;
    salon: DocumentData;
    branchId: string;
    branchName: string;
    operationId: string;
    customerRef: DocumentReference;
    customer: DocumentData;
    allowPhoto: boolean;
  },
) {
  const { salonId, customerRef, customer, branchId, operationId, uid, allowPhoto } = input;
  const customerId = customerRef.id;
  const sessionId = "manual-" + hash(`${salonId}:${uid}:${operationId}`);
  const sessionRef = db.doc(`chair_sessions/${sessionId}`);
  const requestRef = db.doc(`point_requests/${sessionId}`);
  const pointerRef = db.doc(
    `active_service_sessions/${hash(`${salonId}:${customerId}`).slice(0, 40)}`,
  );
  const [active, session, request] = await tx.getAll(pointerRef, sessionRef, requestRef);
  if (active.exists || session.exists || request.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Khách đang có lượt chờ. Hãy xử lý lượt hiện tại trước.",
      {
        errorCode: "ACTIVE_SESSION_EXISTS",
      },
    );
  }
  if (!salonOwnerSwitches(input.salon).acceptWebPointRequests) {
    throw new HttpsError("failed-precondition", "Salon đang tạm dừng nhận yêu cầu tích điểm mới.", {
      errorCode: "FEATURE_DISABLED",
    });
  }
  const now = Timestamp.now();
  if (
    pointCooldownRemainingMs({
      nowMs: now.toMillis(),
      lastVisitAtMs: millis(customer.lastVisitAt),
      nextEligibleAtMs: millis(customer.nextPointEligibleAt),
      cooldownMs: WINDOW_MS,
    }) > 0
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Khách vừa được tích điểm. Chưa thể tạo lượt mới.",
      {
        errorCode: "POINT_COOLDOWN",
      },
    );
  }
  const pointsRequested = input.salon.pointPerVisit ?? 1;
  const points = customer.points ?? 0;
  if (
    !Number.isSafeInteger(pointsRequested) ||
    pointsRequested < 1 ||
    !Number.isSafeInteger(points) ||
    points < 0 ||
    !Number.isSafeInteger(points + pointsRequested)
  ) {
    throw new HttpsError("failed-precondition", "Cấu hình hoặc số dư điểm chưa hợp lệ.");
  }
  const expiresAt = Timestamp.fromMillis(now.toMillis() + WINDOW_MS);
  const customerSummary = {
    name: String(customer.name || "Khách hàng"),
    phoneLast4: customer.phoneLast4 ?? "",
    points,
    allowPhoto,
  };
  const common = {
    salonId,
    branchId,
    branchName: input.branchName,
    customerId,
    customerSummary,
    approvalMode: "staff_confirmation",
    source: "manual_visit",
    pointsRequested,
    photoConsentGranted: allowPhoto,
    photoConsentVersion: "manual-visit-v1",
    photoConsentAt: allowPhoto ? now : null,
    createdBy: uid,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  return {
    sessionId,
    write() {
      tx.create(sessionRef, {
        ...common,
        status: "pending_approval",
        isOpen: true,
        pointRequestId: sessionId,
      });
      tx.create(requestRef, {
        ...common,
        sessionId,
        status: "pending",
        pointsAdded: pointsRequested,
        note: "",
        photoPaths: [],
        photoUrls: [],
        staffId: uid,
        staffName: input.staffName,
      });
      tx.create(pointerRef, { ...common, sessionId, status: "pending_approval", isOpen: true });
      tx.set(
        customerRef,
        {
          activeSessionId: sessionId,
          lastBranchId: branchId,
          lastBranchName: input.branchName,
          ...(allowPhoto ? { allowPhoto: true } : {}),
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
          actorRole: input.role,
          action: "point_request.manual_visit_created",
          targetType: "point_request",
          targetId: sessionId,
          after: { status: "pending" },
          createdAt: now,
        }),
      );
    },
  };
}
