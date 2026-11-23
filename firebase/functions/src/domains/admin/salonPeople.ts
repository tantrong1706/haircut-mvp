import { getAuth } from "firebase-admin/auth";
import { FieldPath, Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createAuthorization } from "../../authz/authorization";
import { auditEventData } from "../audit/auditEvent";

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const invalidInput = () => new HttpsError("invalid-argument", "Salon hoặc trang chưa hợp lệ.");
function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidInput();
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["salonId", "cursor", "pageSize"].includes(key)))
    throw invalidInput();
  const { salonId, cursor, pageSize = 25 } = input;
  if (
    !validId(salonId) ||
    (cursor !== undefined && !validId(cursor)) ||
    typeof pageSize !== "number" ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  )
    throw invalidInput();
  return { salonId, cursor, pageSize };
}
const nameOr = (value: unknown, fallback: string) =>
  typeof value === "string" ? value.trim().slice(0, 120) || fallback : fallback;

export function createAdminSalonPeople(db: Firestore, rateLimit: (uid: string) => Promise<void>) {
  const { assertSystemAdmin } = createAuthorization(db);

  async function ownerFor(salonId: string, ownerId: unknown) {
    if (!validId(ownerId)) return null;
    const [member] = await db.getAll(db.doc(`users/${ownerId}`), {
      fieldMask: ["salonId", "role", "name", "isActive"],
    });
    if (member.get("salonId") !== salonId || member.get("role") !== "owner") return null;
    const name = nameOr(member.get("name"), "Chủ salon");
    try {
      const account = await getAuth().getUser(ownerId);
      return {
        name,
        email: account.email?.trim().slice(0, 320) || null,
        emailVerified: account.emailVerified === true,
        status:
          member.get("isActive") === true && account.disabled !== true
            ? ("active" as const)
            : ("inactive" as const),
      };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "auth/user-not-found") {
        return { name, email: null, emailVerified: false, status: "missing" as const };
      }
      throw new HttpsError("unavailable", "Chưa đọc được trạng thái tài khoản chủ salon.");
    }
  }

  return async (request: { auth?: { uid: string } | null; data?: unknown }) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Bạn cần đăng nhập quản trị.");
    await assertSystemAdmin(uid);
    const { salonId, pageSize, cursor } = parseInput(request.data);
    await rateLimit(uid);
    const [salon] = await db.getAll(db.doc(`salons/${salonId}`), { fieldMask: ["ownerId"] });
    if (!salon.exists) throw new HttpsError("not-found", "Không tìm thấy salon.");
    let query = db
      .collection("customers")
      .where("salonId", "==", salonId)
      .orderBy(FieldPath.documentId())
      .select("name", "phoneLast4", "points", "lastVisitAt")
      .limit(pageSize + 1);
    if (cursor) {
      const [previous] = await db.getAll(db.doc(`customers/${cursor}`), {
        fieldMask: ["salonId"],
      });
      if (!previous.exists || previous.get("salonId") !== salonId)
        throw new HttpsError("invalid-argument", "Mốc phân trang không thuộc salon.");
      query = query.startAfter(cursor);
    }
    const [owner, page] = await Promise.all([ownerFor(salonId, salon.get("ownerId")), query.get()]);
    const customers = page.docs.slice(0, pageSize).map((row) => {
      const suffix = row.get("phoneLast4");
      const points = row.get("points");
      const lastVisit = row.get("lastVisitAt");
      return {
        id: row.id,
        name: nameOr(row.get("name"), "Khách chưa có tên"),
        phoneLast4: typeof suffix === "string" && /^\d{4}$/u.test(suffix) ? suffix : null,
        points:
          typeof points === "number" && Number.isSafeInteger(points) && points >= 0 ? points : null,
        lastVisitAtMs: lastVisit instanceof Timestamp ? lastVisit.toMillis() : null,
      };
    });
    await assertSystemAdmin(uid);
    await db.collection("audit_events").add(
      auditEventData({
        salonId,
        actorId: uid,
        actorRole: "system_admin",
        action: "admin.salon_people_viewed",
        targetType: "salon",
        targetId: salonId,
        metadata: { customerRows: customers.length },
      }),
    );
    return {
      salonId,
      owner,
      customers,
      nextCursor: page.size > pageSize ? (customers[customers.length - 1]?.id ?? null) : null,
    };
  };
}
