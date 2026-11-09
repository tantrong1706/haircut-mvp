import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { auditEventData } from "../audit/auditEvent";

export function parseCustomerPointAdjustment(data: Record<string, unknown> | undefined) {
  const { customerId, expectedPoints, delta } = data ?? {};
  const reason = typeof data?.reason === "string" ? data.reason.trim() : "";
  if (typeof customerId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(customerId)) {
    throw new HttpsError("invalid-argument", "Thông tin khách không hợp lệ.");
  }
  if (
    typeof expectedPoints !== "number" ||
    !Number.isSafeInteger(expectedPoints) ||
    expectedPoints < 0
  ) {
    throw new HttpsError("invalid-argument", "Số điểm hiện tại không hợp lệ.");
  }
  if (
    typeof delta !== "number" ||
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 100
  ) {
    throw new HttpsError("invalid-argument", "Mỗi lần chỉ được cộng hoặc trừ từ 1 đến 100 điểm.");
  }
  if (reason.length < 5 || reason.length > 200 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(reason)) {
    throw new HttpsError("invalid-argument", "Ghi lý do từ 5 đến 200 ký tự trên một dòng.");
  }
  return { customerId, expectedPoints, delta, reason };
}

export async function applyCustomerPointAdjustment(
  db: Firestore,
  input: ReturnType<typeof parseCustomerPointAdjustment> & {
    uid: string;
    salonId: string;
    idempotencyKey: string;
  },
) {
  const { uid, salonId, customerId, delta, expectedPoints, reason, idempotencyKey } = input;
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const operationId = hash(["customer.points_adjusted", salonId, uid, idempotencyKey]);
  const fingerprint = hash([customerId, expectedPoints, delta, reason]);
  const customerRef = db.collection("customers").doc(customerId);
  const operationRef = db.collection("idempotency_keys").doc(operationId);
  const eventRef = db.collection("audit_events").doc(operationId);
  const now = Timestamp.now();
  return db.runTransaction(async (tx) => {
    const [customerSnap, operationSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(operationRef),
    ]);
    const customer = customerSnap.data();
    if (!customer || customer.salonId !== salonId) {
      throw new HttpsError("not-found", "Không tìm thấy khách trong salon này.");
    }
    const currentPoints = customer.points;
    if (
      typeof currentPoints !== "number" ||
      !Number.isSafeInteger(currentPoints) ||
      currentPoints < 0
    ) {
      throw new HttpsError("failed-precondition", "Số điểm hiện tại không hợp lệ.");
    }
    const operation = operationSnap.data();
    if (operation) {
      if (
        operation.fingerprint !== fingerprint ||
        operation.customerId !== customerId ||
        operation.salonId !== salonId ||
        operation.actorId !== uid
      ) {
        throw new HttpsError(
          "already-exists",
          "Yêu cầu điều chỉnh đã được dùng cho thao tác khác.",
        );
      }
      return {
        pointsBefore: Number(operation.pointsBefore),
        pointsAfter: Number(operation.pointsAfter),
        currentPoints,
        alreadyProcessed: true,
      };
    }
    if (currentPoints !== expectedPoints) {
      throw new HttpsError(
        "failed-precondition",
        "Số điểm đã thay đổi. Hãy tìm lại khách và kiểm tra trước khi điều chỉnh.",
      );
    }
    const pointsAfter = currentPoints + delta;
    if (!Number.isSafeInteger(pointsAfter) || pointsAfter < 0) {
      throw new HttpsError(
        "failed-precondition",
        "Không thể điều chỉnh số dư điểm xuống dưới 0 hoặc vượt giới hạn.",
      );
    }
    tx.update(customerRef, { points: pointsAfter, updatedAt: now });
    tx.create(operationRef, {
      operation: "customer.points_adjusted",
      salonId,
      customerId,
      actorId: uid,
      fingerprint,
      pointsBefore: currentPoints,
      pointsAfter,
      createdAt: now,
    });
    tx.create(
      eventRef,
      auditEventData({
        salonId,
        actorId: uid,
        actorRole: "owner",
        action: "customer.points_adjusted",
        targetType: "customer",
        targetId: customerId,
        requestId: operationId,
        before: { points: currentPoints },
        after: { points: pointsAfter },
        metadata: { delta, reason },
        createdAt: now,
      }),
    );
    return {
      pointsBefore: currentPoints,
      pointsAfter,
      currentPoints: pointsAfter,
      alreadyProcessed: false,
    };
  });
}
