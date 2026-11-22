import { createHash, randomBytes } from "node:crypto";
import { Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertSalonIsOperational, createAuthorization } from "../../authz/authorization";
import { buildNameSearchPrefixes, normalizeSearchText } from "../../customerSearch";
import { canUserAccessBranch } from "../../security";
import { auditEventData } from "../audit/auditEvent";
import { normalizedCustomerName } from "./customerName";
import { prepareManualVisit } from "./manualVisit";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const idPattern = /^[A-Za-z0-9_-]{1,128}$/u;
const duplicatePhone = () =>
  new HttpsError("already-exists", "Số điện thoại đã có trong salon.", {
    errorCode: "MANUAL_CUSTOMER_PHONE_EXISTS",
  });

function optionalPhone(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 32) {
    throw new HttpsError("invalid-argument", "Vui lòng nhập đúng số di động Việt Nam.");
  }
  if (!value.trim()) return null;
  const compact = value.trim().replace(/[\s().-]/gu, "");
  if (/^0[35789]\d{8}$/u.test(compact)) return compact;
  if (/^\+?84[35789]\d{8}$/u.test(compact)) return "0" + compact.replace(/^\+?84/u, "");
  throw new HttpsError("invalid-argument", "Vui lòng nhập đúng số di động Việt Nam.");
}

export async function createManualCustomerProfile(
  db: Firestore,
  input: { uid: string; salonId: string; data: Record<string, unknown> },
  guards: {
    rateLimit: (uid: string, salonId: string) => Promise<void>;
    prepareCounter: (salonId: string) => Promise<void>;
    assertQuota: (salon: DocumentData) => number;
    featureCheck: (salonId: string, appVersion: unknown) => Promise<unknown>;
  },
) {
  const { uid, salonId, data } = input;
  if (!idPattern.test(salonId)) throw new HttpsError("invalid-argument", "Mã salon không hợp lệ.");
  const { assertSalonRole, assertBranchAccess, assertBranchIsOperational } =
    createAuthorization(db);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  if (data.startVisit !== undefined && typeof data.startVisit !== "boolean")
    throw new HttpsError("invalid-argument", "Loại thao tác thêm khách không hợp lệ.");
  const startVisit = data.startVisit === true;
  if (startVisit && data.allowPhoto !== undefined && typeof data.allowPhoto !== "boolean")
    throw new HttpsError("invalid-argument", "Xác nhận lưu ảnh không hợp lệ.");
  const allowPhoto = startVisit && data.allowPhoto === true;
  const name = normalizedCustomerName(data.name);
  const phone = optionalPhone(data.phone);
  const phoneLast4 = phone?.slice(-4) ?? null;
  const suppliedBranch = data.branchId;
  if (
    (suppliedBranch !== undefined || user.role === "staff" || startVisit) &&
    (typeof suppliedBranch !== "string" || !idPattern.test(suppliedBranch))
  ) {
    throw new HttpsError("invalid-argument", "Chọn chi nhánh được phân công để thêm khách.");
  }
  const branchId = typeof suppliedBranch === "string" ? suppliedBranch : null;
  if (branchId) await assertBranchAccess(user, branchId);
  const suppliedOp = data.operationId;
  if (
    suppliedOp !== undefined &&
    (typeof suppliedOp !== "string" || !/^[A-Za-z0-9_-]{16,128}$/u.test(suppliedOp))
  ) {
    throw new HttpsError("invalid-argument", "Mã thao tác không hợp lệ.");
  }
  const operationId = typeof suppliedOp === "string" ? suppliedOp : randomBytes(16).toString("hex");
  await guards.rateLimit(uid, salonId);
  if (startVisit) {
    if (typeof suppliedOp !== "string")
      throw new HttpsError("invalid-argument", "Cần mã thao tác khi tạo lượt mới.");
    await guards.featureCheck(salonId, data.appVersion);
  }
  if (branchId) {
    const branch = await db.doc(`branches/${branchId}`).get();
    assertBranchIsOperational(branch.data(), salonId, branchId);
  }
  await guards.prepareCounter(salonId);
  const customerId = hash(`${salonId}:manual:${phone ?? randomBytes(16).toString("hex")}`).slice(
    0,
    40,
  );
  const receiptRef = db.doc(
    `idempotency_keys/${hash(JSON.stringify([startVisit ? "customer.manual_visit" : "customer.manual_create", salonId, uid, operationId]))}`,
  );
  const customerRef = db.doc(`customers/${customerId}`);
  const salonRef = db.doc(`salons/${salonId}`);
  const auditRef = db.collection("audit_events").doc();
  const fingerprint = hash(
    JSON.stringify(
      startVisit ? [branchId, name, phone, allowPhoto, true] : [branchId, name, phone],
    ),
  );
  return db.runTransaction(async (tx) => {
    const [member, salon, receipt, profile] = await tx.getAll(
      db.doc(`users/${uid}`),
      salonRef,
      receiptRef,
      customerRef,
    );
    const current = member.data();
    if (
      !current ||
      String(current.salonId ?? "").trim() !== salonId ||
      current.isActive !== true ||
      current.role !== user.role ||
      (user.role === "staff" &&
        (current.inviteStatus === "pending" ||
          !branchId ||
          !canUserAccessBranch({ ...current, role: "staff" }, branchId)))
    ) {
      throw new HttpsError("permission-denied", "Tài khoản không còn quyền thêm khách tại đây.");
    }
    if (!salon.exists) throw new HttpsError("not-found", "Không tìm thấy salon.");
    assertSalonIsOperational(salon.data());
    const branch = branchId ? await tx.get(db.doc(`branches/${branchId}`)) : undefined;
    if (branchId) assertBranchIsOperational(branch?.data(), salonId, branchId);
    if (receipt.exists) {
      if (receipt.get("fingerprint") !== fingerprint) {
        throw new HttpsError("already-exists", "Mã thao tác đã được dùng cho hồ sơ khác.");
      }
      return {
        customerId: String(receipt.get("customerId")),
        ...(startVisit ? { sessionId: String(receipt.get("sessionId")) } : {}),
      };
    }
    if (profile.exists && !startVisit) throw duplicatePhone();
    let selectedProfile = profile;
    if (phoneLast4 && phone) {
      const siblings = await tx.get(
        db
          .collection("customers")
          .where("salonId", "==", salonId)
          .where("phoneLast4", "==", phoneLast4)
          .limit(101)
          .select("phone"),
      );
      // Use the existing suffix index but compare the entire number, not just the suffix.
      // Legacy profiles may have a full phone but no suffix. Equality queries reuse
      // automatic indexes, stay tenant-scoped and do not require a production index rollout.
      const exactPhones = [phone, "+84" + phone.slice(1), "84" + phone.slice(1)];
      const exactGroups = await Promise.all(
        exactPhones.map((value) =>
          tx.get(
            db
              .collection("customers")
              .where("salonId", "==", salonId)
              .where("phone", "==", value)
              .limit(2)
              .select("phone"),
          ),
        ),
      );
      const candidates = new Map(
        [...siblings.docs, ...exactGroups.flatMap((group) => group.docs)].map((row) => [
          row.id,
          row,
        ]),
      );
      const matches = [...candidates.values()].filter((row) => {
        try {
          return optionalPhone(row.get("phone")) === phone;
        } catch {
          return false;
        }
      });
      if (!startVisit && matches.length) throw duplicatePhone();
      if (startVisit && matches.length > 1)
        throw new HttpsError(
          "failed-precondition",
          "Danh bạ có nhiều hồ sơ cùng số. Hãy đối chiếu khách trong danh sách trước.",
          { errorCode: "MANUAL_CUSTOMER_AMBIGUOUS" },
        );
      if (siblings.size > 100) {
        throw new HttpsError(
          "failed-precondition",
          "Có quá nhiều hồ sơ trùng 4 số cuối. Hãy tìm và đối chiếu khách trước.",
        );
      }
      if (startVisit && matches[0]) selectedProfile = await tx.get(matches[0].ref);
    }
    if (selectedProfile.exists && selectedProfile.get("salonId") !== salonId)
      throw new HttpsError("permission-denied", "Hồ sơ khách không thuộc salon này.");
    const effectiveRef = selectedProfile.exists ? selectedProfile.ref : customerRef;
    const effectiveId = effectiveRef.id;
    const customerCount = selectedProfile.exists ? null : guards.assertQuota(salon.data() ?? {});
    const now = Timestamp.now();
    const payload = {
      salonId,
      source: "manual",
      zaloUserId: null,
      name,
      phone,
      phoneLast4,
      nameSearch: normalizeSearchText(name),
      namePrefixes: buildNameSearchPrefixes(name),
      points: 0,
      allowPhoto: false,
      createdAt: now,
      updatedAt: now,
      ...(branchId ? { createdAtBranchId: branchId } : {}),
    };
    const visit = startVisit
      ? await prepareManualVisit(db, tx, {
          uid,
          role: user.role,
          staffName: String(current.name || "Nhân viên"),
          salonId,
          salon: salon.data() ?? {},
          branchId: branchId!,
          branchName: String(branch?.get("name") || "Chi nhánh"),
          operationId,
          customerRef: effectiveRef,
          customer: selectedProfile.data() ?? payload,
          allowPhoto,
        })
      : undefined;
    if (customerCount !== null) {
      tx.create(customerRef, payload);
      tx.update(salonRef, { customerCount: customerCount + 1, updatedAt: now });
    }
    visit?.write();
    tx.create(receiptRef, {
      customerId: effectiveId,
      ...(visit ? { sessionId: visit.sessionId } : {}),
      salonId,
      fingerprint,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 86_400_000),
    });
    if (!selectedProfile.exists)
      tx.create(
        auditRef,
        auditEventData({
          salonId,
          branchId,
          actorId: uid,
          actorRole: user.role,
          action: "customer.manual_created",
          targetType: "customer",
          targetId: effectiveId,
          createdAt: now,
        }),
      );
    return { customerId: effectiveId, ...(visit ? { sessionId: visit.sessionId } : {}) };
  });
}
