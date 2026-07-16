import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = process.env.GCLOUD_PROJECT || "demo-haircut";
const salonA = "salon-a";
const salonB = "salon-b";
const branchA = "branch-a";
const branchB = "branch-b";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "..", "firestore.rules"), "utf8"),
    },
    storage: {
      rules: readFileSync(resolve(process.cwd(), "..", "storage.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "owner-a"), member(salonA, "owner")),
      setDoc(doc(db, "users", "staff-a"), member(salonA, "staff", [branchA])),
      setDoc(doc(db, "users", "staff-other-a"), member(salonA, "staff", [branchB])),
      setDoc(doc(db, "users", "owner-b"), member(salonB, "owner")),
      setDoc(doc(db, "users", "owner-suspended"), member("salon-suspended", "owner")),
      setDoc(doc(db, "users", "inactive-a"), {
        ...member(salonA, "staff", [branchA]),
        isActive: false,
      }),
      setDoc(doc(db, "users", "fake-role-a"), {
        salonId: salonA,
        role: "admin",
        isActive: true,
        branchIds: [branchA],
      }),
      setDoc(doc(db, "salons", salonA), { name: "Salon A", ownerId: "owner-a" }),
      setDoc(doc(db, "salons", salonB), { name: "Salon B", ownerId: "owner-b" }),
      setDoc(doc(db, "salons", "salon-suspended"), {
        name: "Salon đã khóa",
        ownerId: "owner-suspended",
        status: "suspended",
        isActive: false,
      }),
      setDoc(doc(db, "branches", branchA), {
        salonId: salonA,
        name: "Chi nhánh A",
        isActive: true,
      }),
      setDoc(doc(db, "branches", branchB), {
        salonId: salonA,
        name: "Chi nhánh B",
        isActive: true,
      }),
      setDoc(doc(db, "customers", "customer-a"), customer(salonA)),
      setDoc(doc(db, "customers", "customer-b"), customer(salonB)),
      setDoc(doc(db, "customers", "customer-photo"), {
        ...customer(salonA),
        allowPhoto: true,
      }),
      setDoc(doc(db, "chair_sessions", "session-a"), session(salonA, branchA, "customer-a")),
      setDoc(doc(db, "chair_sessions", "session-b"), session(salonA, branchB, "customer-a")),
      setDoc(
        doc(db, "chair_sessions", "session-suspended"),
        session("salon-suspended", "branch-suspended", "customer-suspended"),
      ),
      setDoc(doc(db, "chair_sessions", "session-photo"), {
        ...session(salonA, branchA, "customer-photo"),
        status: "serving",
        assignedStaffId: "staff-a",
      }),
      setDoc(doc(db, "chair_sessions", "session-owner-photo"), {
        ...session(salonA, branchA, "customer-photo"),
        status: "pending_approval",
        assignedStaffId: "staff-a",
      }),
      setDoc(doc(db, "chair_sessions", "session-owner-no-consent"), {
        ...session(salonA, branchA, "customer-a"),
        status: "pending_approval",
        assignedStaffId: "staff-a",
      }),
      setDoc(doc(db, "haircut_records", "record-a"), privateRecord(salonA, "customer-a")),
      setDoc(doc(db, "reward_history", "reward-a"), privateRecord(salonA, "customer-a")),
      setDoc(doc(db, "active_service_sessions", "active-a"), {
        salonId: salonA,
        branchId: branchA,
        customerId: "customer-a",
        sessionId: "session-a",
      }),
      setDoc(doc(db, "audit_events", "audit-a"), {
        salonId: salonA,
        branchId: branchA,
        actorUid: "staff-a",
        action: "session.claimed",
      }),
      setDoc(doc(db, "device_tokens", "token-a"), {
        salonId: salonA,
        uid: "staff-a",
        token: "private-device-token",
      }),
      setDoc(doc(db, "support_requests", "support-a"), {
        salonId: salonA,
        branchId: branchA,
        requestedBy: "owner-a",
        status: "open",
      }),
      setDoc(doc(db, "lucky_wheel", salonA), { salonId: salonA, requiredPoints: 5, slots: [] }),
      setDoc(doc(db, "_public_rate_limits", "private-counter"), {
        count: 1,
        expiresAt: new Date(),
      }),
    ]);
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore production rules", () => {
  it("chặn người chưa đăng nhập đọc dữ liệu riêng của khách", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "customers", "customer-a")));
    await assertFails(getDoc(doc(db, "chair_sessions", "session-a")));
    await assertFails(getDocs(query(collection(db, "haircut_records"), limit(20))));
    await assertFails(getDocs(query(collection(db, "reward_history"), limit(20))));
  });

  it("mặc định từ chối collection và đường dẫn Storage chưa khai báo", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();

    await assertFails(getDoc(doc(ownerDb, "internal_config", "secret")));
    await assertFails(
      uploadBytes(ref(ownerStorage, "internal/unlisted.txt"), new Uint8Array([1]), {
        contentType: "text/plain",
      }),
    );
  });

  it("chỉ cho thành viên đang hoạt động đọc dữ liệu salon của mình", async () => {
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();

    await assertFails(getDoc(doc(staffDb, "customers", "customer-a")));
    await assertFails(
      getDocs(query(collection(staffDb, "customers"), where("salonId", "==", salonA))),
    );
    await assertSucceeds(getDoc(doc(ownerDb, "customers", "customer-a")));
    await assertFails(getDoc(doc(staffDb, "customers", "customer-b")));
    await assertFails(getDoc(doc(staffDb, "haircut_records", "record-a")));
  });

  it("chặn staff đọc hàng chờ của chi nhánh không được phân công", async () => {
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();

    await assertSucceeds(getDoc(doc(staffDb, "chair_sessions", "session-a")));
    await assertFails(getDoc(doc(staffDb, "chair_sessions", "session-b")));
    await assertSucceeds(getDoc(doc(staffDb, "branches", branchA)));
    await assertFails(getDoc(doc(staffDb, "branches", branchB)));
  });

  it("chặn tài khoản inactive và role không hợp lệ", async () => {
    const inactiveDb = testEnv.authenticatedContext("inactive-a").firestore();
    const fakeRoleDb = testEnv.authenticatedContext("fake-role-a").firestore();

    await assertFails(getDoc(doc(inactiveDb, "chair_sessions", "session-a")));
    await assertFails(getDoc(doc(fakeRoleDb, "chair_sessions", "session-a")));
    await assertFails(getDoc(doc(fakeRoleDb, "salons", salonA)));
  });

  it("chặn toàn bộ thành viên khi salon bị khóa", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-suspended").firestore();

    await assertFails(getDoc(doc(ownerDb, "salons", "salon-suspended")));
    await assertFails(getDoc(doc(ownerDb, "chair_sessions", "session-suspended")));
  });

  it("bắt buộc query hàng chờ giới hạn đúng salon và chi nhánh", async () => {
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();
    const scopedQuery = query(
      collection(staffDb, "chair_sessions"),
      where("salonId", "==", salonA),
      where("branchId", "==", branchA),
      limit(20),
    );
    const broadQuery = query(
      collection(staffDb, "chair_sessions"),
      where("salonId", "==", salonA),
      limit(20),
    );

    await assertSucceeds(getDocs(scopedQuery));
    await assertFails(getDocs(broadQuery));
  });

  it("chặn nhân viên tự tạo yêu cầu điểm hoặc sửa phiên", async () => {
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();

    await assertFails(
      setDoc(doc(staffDb, "point_requests", "fake"), {
        salonId: salonA,
        customerId: "customer-a",
        pointsRequested: 99,
        status: "pending",
      }),
    );
    await assertFails(
      updateDoc(doc(staffDb, "chair_sessions", "session-a"), {
        status: "completed",
      }),
    );
  });

  it("chặn owner sửa điểm trực tiếp hoặc dữ liệu salon khác", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();

    await assertFails(updateDoc(doc(ownerDb, "customers", "customer-a"), { points: 999 }));
    await assertFails(updateDoc(doc(ownerDb, "salons", salonB), { name: "Chiếm quyền" }));
  });

  it("chặn đọc công khai cấu hình vòng quay để tránh dò salon", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "lucky_wheel", salonA)));
  });

  it("không cho thành viên salon đọc hoặc sửa bộ đếm chống spam", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();

    await assertFails(getDoc(doc(ownerDb, "_public_rate_limits", "private-counter")));
    await assertFails(setDoc(doc(ownerDb, "_public_rate_limits", "forged-counter"), { count: 0 }));
  });

  it("giữ collection vận hành ở chế độ server-only", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-a").firestore();
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();
    const serverOnlyDocuments = [
      ["active_service_sessions", "active-a"],
      ["audit_events", "audit-a"],
      ["device_tokens", "token-a"],
      ["support_requests", "support-a"],
    ] as const;

    for (const [collectionName, documentId] of serverOnlyDocuments) {
      await assertFails(getDoc(doc(ownerDb, collectionName, documentId)));
      await assertFails(getDoc(doc(staffDb, collectionName, documentId)));
      await assertFails(
        setDoc(doc(ownerDb, collectionName, `forged-${documentId}`), { salonId: salonA }),
      );
    }
  });

  it("chỉ cho nhân viên phụ trách tải ảnh vào đúng lượt khách đã đồng ý", async () => {
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const otherStaffStorage = testEnv.authenticatedContext("staff-other-a").storage();
    const allowedPath =
      `salons/${salonA}/customers/customer-photo/haircuts/session-photo/` +
      "photo-123456789abc.jpg";
    const deniedConsentPath =
      `salons/${salonA}/customers/customer-a/haircuts/session-a/` + "photo-123456789abc.jpg";
    const allowed = ref(staffStorage, allowedPath);
    const wrongStaff = ref(otherStaffStorage, allowedPath);
    const deniedConsent = ref(staffStorage, deniedConsentPath);
    const bytes = new Uint8Array([1, 2, 3]);
    const validMetadata = {
      contentType: "image/jpeg",
      customMetadata: {
        salonId: salonA,
        customerId: "customer-photo",
        sessionId: "session-photo",
        branchId: branchA,
        uploaderUid: "staff-a",
      },
    };

    await assertSucceeds(uploadBytes(allowed, bytes, validMetadata));
    await assertSucceeds(getBytes(allowed));
    await assertFails(uploadBytes(wrongStaff, bytes, validMetadata));
    await assertFails(deleteObject(wrongStaff));
    await assertFails(
      uploadBytes(deniedConsent, bytes, {
        ...validMetadata,
        customMetadata: {
          ...validMetadata.customMetadata,
          customerId: "customer-a",
          sessionId: "session-a",
        },
      }),
    );
    await assertSucceeds(deleteObject(allowed));
  });

  it("cho owner bổ sung ảnh ở lượt chờ duyệt nhưng vẫn bắt buộc khách đồng ý", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const otherOwnerStorage = testEnv.authenticatedContext("owner-b").storage();
    const path =
      `salons/${salonA}/customers/customer-photo/haircuts/session-owner-photo/` +
      "photo-owner-12345678.jpg";
    const noConsentPath =
      `salons/${salonA}/customers/customer-a/haircuts/session-owner-no-consent/` +
      "photo-owner-87654321.jpg";
    const bytes = new Uint8Array([1, 2, 3]);
    const metadata = {
      contentType: "image/jpeg",
      customMetadata: {
        salonId: salonA,
        customerId: "customer-photo",
        sessionId: "session-owner-photo",
        branchId: branchA,
        uploaderUid: "owner-a",
      },
    };

    await assertSucceeds(uploadBytes(ref(ownerStorage, path), bytes, metadata));
    await assertSucceeds(getBytes(ref(ownerStorage, path)));
    await assertFails(
      uploadBytes(ref(staffStorage, path), bytes, {
        ...metadata,
        customMetadata: { ...metadata.customMetadata, uploaderUid: "staff-a" },
      }),
    );
    await assertFails(
      uploadBytes(ref(otherOwnerStorage, path), bytes, {
        ...metadata,
        customMetadata: { ...metadata.customMetadata, uploaderUid: "owner-b" },
      }),
    );
    await assertFails(
      uploadBytes(ref(ownerStorage, noConsentPath), bytes, {
        ...metadata,
        customMetadata: {
          ...metadata.customMetadata,
          customerId: "customer-a",
          sessionId: "session-owner-no-consent",
        },
      }),
    );
    await assertSucceeds(deleteObject(ref(ownerStorage, path)));
  });

  it("từ chối ảnh có metadata giả hoặc định dạng không hợp lệ", async () => {
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const basePath = `salons/${salonA}/customers/customer-photo/haircuts/session-photo`;
    const bytes = new Uint8Array([1, 2, 3]);

    await assertFails(
      uploadBytes(ref(staffStorage, `${basePath}/photo-123456789abc.jpg`), bytes, {
        contentType: "image/jpeg",
        customMetadata: {
          salonId: salonA,
          customerId: "customer-photo",
          sessionId: "session-photo",
          uploaderUid: "staff-other-a",
        },
      }),
    );
    await assertFails(
      uploadBytes(
        ref(staffStorage, `${basePath}/photo-oversized123.jpg`),
        new Uint8Array(3 * 1024 * 1024 + 1),
        {
          contentType: "image/jpeg",
          customMetadata: {
            salonId: salonA,
            customerId: "customer-photo",
            sessionId: "session-photo",
            branchId: branchA,
            uploaderUid: "staff-a",
          },
        },
      ),
    );
    await assertFails(
      uploadBytes(ref(staffStorage, `${basePath}/photo-abcdef123456.png`), bytes, {
        contentType: "image/png",
        customMetadata: {
          salonId: salonA,
          customerId: "customer-photo",
          sessionId: "session-photo",
          uploaderUid: "staff-a",
        },
      }),
    );
  });

  it("chỉ owner được tải avatar của chính mình", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const otherOwnerStorage = testEnv.authenticatedContext("owner-b").storage();
    const ownAvatar = ref(ownerStorage, `salons/${salonA}/owner_avatars/owner-a/avatar.png`);
    const forgedAvatar = ref(staffStorage, `salons/${salonA}/owner_avatars/owner-a/avatar.png`);
    const bytes = new Uint8Array([1, 2, 3]);

    await assertSucceeds(uploadBytes(ownAvatar, bytes, { contentType: "image/png" }));
    await assertSucceeds(getBytes(ownAvatar));
    await assertFails(uploadBytes(forgedAvatar, bytes, { contentType: "image/png" }));
    await assertFails(getBytes(ref(otherOwnerStorage, ownAvatar.fullPath)));
    await assertFails(deleteObject(ref(otherOwnerStorage, ownAvatar.fullPath)));
    await assertSucceeds(deleteObject(ownAvatar));
  });

  it("chỉ owner đúng salon được quản lý ảnh đại diện salon hợp lệ", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const otherOwnerStorage = testEnv.authenticatedContext("owner-b").storage();
    const avatarPath = `salons/${salonA}/branding/avatar.webp`;
    const bytes = new Uint8Array([1, 2, 3]);
    const metadata = {
      contentType: "image/webp",
      customMetadata: { salonId: salonA, ownerUid: "owner-a" },
    };

    await assertSucceeds(uploadBytes(ref(ownerStorage, avatarPath), bytes, metadata));
    await assertSucceeds(getBytes(ref(ownerStorage, avatarPath)));
    await assertFails(uploadBytes(ref(staffStorage, avatarPath), bytes, metadata));
    await assertFails(
      uploadBytes(ref(otherOwnerStorage, avatarPath), bytes, {
        ...metadata,
        customMetadata: { salonId: salonA, ownerUid: "owner-b" },
      }),
    );
    await assertFails(
      uploadBytes(ref(ownerStorage, avatarPath), bytes, {
        ...metadata,
        customMetadata: { salonId: salonB, ownerUid: "owner-a" },
      }),
    );
    await assertFails(
      uploadBytes(ref(ownerStorage, avatarPath), bytes, {
        ...metadata,
        contentType: "image/png",
      }),
    );
    await assertFails(
      uploadBytes(ref(ownerStorage, `salons/${salonA}/branding/logo.webp`), bytes, metadata),
    );
    await assertFails(getBytes(ref(otherOwnerStorage, avatarPath)));
    await assertFails(deleteObject(ref(otherOwnerStorage, avatarPath)));
    await assertSucceeds(deleteObject(ref(ownerStorage, avatarPath)));
  });

  it("tắt upload ảnh theo feature flag riêng của salon", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "salons", salonA, "settings", "features"), {
        photoUploadEnabled: false,
        maintenanceMode: false,
      });
    });
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();
    const avatarPath = `salons/${salonA}/branding/avatar.webp`;

    await assertFails(
      uploadBytes(ref(ownerStorage, avatarPath), new Uint8Array([1, 2, 3]), {
        contentType: "image/webp",
        customMetadata: { salonId: salonA, ownerUid: "owner-a" },
      }),
    );
  });
});

function member(salonId: string, role: "owner" | "staff", branchIds: string[] = []) {
  return { salonId, role, name: role, isActive: true, branchIds };
}

function customer(salonId: string) {
  return { salonId, name: "Khách", points: 3, allowPhoto: false };
}

function session(salonId: string, branchId: string, customerId: string) {
  return { salonId, branchId, customerId, status: "waiting" };
}

function privateRecord(salonId: string, customerId: string) {
  return { salonId, branchId: branchA, customerId, status: "unused", rewardCode: "HC-SECRET" };
}
