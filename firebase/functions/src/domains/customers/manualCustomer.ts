import { createHash, randomBytes } from "node:crypto";
import { Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { assertSalonIsOperational, createAuthorization } from "../../authz/authorization";
import { buildNameSearchPrefixes, normalizeSearchText } from "../../customerSearch";
import { canUserAccessBranch } from "../../security";
import { auditEventData } from "../audit/auditEvent";
import { normalizedCustomerName } from "./customerName";

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
  },
) {
  const { uid, salonId, data } = input;
  if (!idPattern.test(salonId)) throw new HttpsError("invalid-argument", "Mã salon không hợp lệ.");
  const { assertSalonRole, assertBranchAccess, assertBranchIsOperational } =
    createAuthorization(db);
  const user = await assertSalonRole(uid, salonId, ["owner", "staff"]);
  const name = normalizedCustomerName(data.name);
  const phone = optionalPhone(data.phone);
  const phoneLast4 = phone?.slice(-4) ?? null;
  const suppliedBranch = data.branchId;
  if (
    (suppliedBranch !== undefined || user.role === "staff") &&
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
    `idempotency_keys/${hash(JSON.stringify(["customer.manual_create", salonId, uid, operationId]))}`,
  );
  const customerRef = db.doc(`customers/${customerId}`);
  const salonRef = db.doc(`salons/${salonId}`);
  const auditRef = db.collection("audit_events").doc();
  const fingerprint = hash(JSON.stringify([branchId, name, phone]));
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
    if (branchId)
      assertBranchIsOperational(
        (await tx.get(db.doc(`branches/${branchId}`))).data(),
        salonId,
        branchId,
      );
    if (receipt.exists) {
      if (receipt.get("fingerprint") !== fingerprint) {
        throw new HttpsError("already-exists", "Mã thao tác đã được dùng cho hồ sơ khác.");
      }
      return { customerId: String(receipt.get("customerId")) };
    }
    if (profile.exists) throw duplicatePhone();
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
      if (
        siblings.docs.some((row) => {
          try {
            return optionalPhone(row.get("phone")) === phone;
          } catch {
            return false;
          }
        })
      )
        throw duplicatePhone();
      if (siblings.size > 100) {
        throw new HttpsError(
          "failed-precondition",
          "Có quá nhiều hồ sơ trùng 4 số cuối. Hãy tìm và đối chiếu khách trước.",
        );
      }
    }
    const customerCount = guards.assertQuota(salon.data() ?? {});
    const now = Timestamp.now();
    tx.create(customerRef, {
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
    });
    tx.update(salonRef, { customerCount: customerCount + 1, updatedAt: now });
    tx.create(receiptRef, {
      customerId,
      salonId,
      fingerprint,
      expiresAt: Timestamp.fromMillis(now.toMillis() + 86_400_000),
    });
    tx.create(
      auditRef,
      auditEventData({
        salonId,
        branchId,
        actorId: uid,
        actorRole: user.role,
        action: "customer.manual_created",
        targetType: "customer",
        targetId: customerId,
        createdAt: now,
      }),
    );
    return { customerId };
  });
}
