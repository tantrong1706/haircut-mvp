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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "owner-a"), member(salonA, "owner")),
      setDoc(doc(db, "users", "staff-a"), member(salonA, "staff")),
      setDoc(doc(db, "users", "owner-b"), member(salonB, "owner")),
      setDoc(doc(db, "salons", salonA), { name: "Salon A", ownerId: "owner-a" }),
      setDoc(doc(db, "salons", salonB), { name: "Salon B", ownerId: "owner-b" }),
      setDoc(doc(db, "customers", "customer-a"), customer(salonA)),
      setDoc(doc(db, "customers", "customer-b"), customer(salonB)),
      setDoc(doc(db, "customers", "customer-photo"), {
        ...customer(salonA),
        allowPhoto: true,
      }),
      setDoc(doc(db, "chair_sessions", "session-a"), session(salonA, "customer-a")),
      setDoc(doc(db, "haircut_records", "record-a"), privateRecord(salonA, "customer-a")),
      setDoc(doc(db, "reward_history", "reward-a"), privateRecord(salonA, "customer-a")),
      setDoc(doc(db, "lucky_wheel", salonA), { salonId: salonA, requiredPoints: 5, slots: [] }),
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

  it("chỉ cho thành viên đang hoạt động đọc dữ liệu salon của mình", async () => {
    const staffDb = testEnv.authenticatedContext("staff-a").firestore();

    await assertSucceeds(getDoc(doc(staffDb, "customers", "customer-a")));
    await assertFails(getDoc(doc(staffDb, "customers", "customer-b")));
    await assertSucceeds(
      getDocs(query(collection(staffDb, "customers"), where("salonId", "==", salonA))),
    );
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

  it("chỉ cho thành viên salon tải ảnh khách khi khách đã đồng ý", async () => {
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const allowed = ref(staffStorage, `salons/${salonA}/customers/customer-photo/style.webp`);
    const denied = ref(staffStorage, `salons/${salonA}/customers/customer-a/style.webp`);
    const bytes = new Uint8Array([1, 2, 3]);

    await assertSucceeds(uploadBytes(allowed, bytes, { contentType: "image/webp" }));
    await assertFails(uploadBytes(denied, bytes, { contentType: "image/webp" }));
  });

  it("chỉ owner được tải avatar của chính mình", async () => {
    const ownerStorage = testEnv.authenticatedContext("owner-a").storage();
    const staffStorage = testEnv.authenticatedContext("staff-a").storage();
    const ownAvatar = ref(ownerStorage, `salons/${salonA}/owner_avatars/owner-a/avatar.png`);
    const forgedAvatar = ref(staffStorage, `salons/${salonA}/owner_avatars/owner-a/avatar.png`);
    const bytes = new Uint8Array([1, 2, 3]);

    await assertSucceeds(uploadBytes(ownAvatar, bytes, { contentType: "image/png" }));
    await assertSucceeds(getBytes(ownAvatar));
    await assertFails(uploadBytes(forgedAvatar, bytes, { contentType: "image/png" }));
    await assertSucceeds(deleteObject(ownAvatar));
  });
});

function member(salonId: string, role: "owner" | "staff") {
  return { salonId, role, name: role, isActive: true };
}

function customer(salonId: string) {
  return { salonId, name: "Khách", points: 3, allowPhoto: false };
}

function session(salonId: string, customerId: string) {
  return { salonId, customerId, status: "waiting" };
}

function privateRecord(salonId: string, customerId: string) {
  return { salonId, customerId, status: "unused", rewardCode: "HC-SECRET" };
}
