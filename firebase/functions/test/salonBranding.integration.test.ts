import { deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { updateSalonAvatar } from "../src/index";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.GCLOUD_PROJECT || "demo-haircut";
const db = getFirestore();

describe.skipIf(!emulatorHost)("updateSalonAvatar callable", () => {
  beforeEach(async () => {
    const response = await fetch(
      `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Không xóa được dữ liệu emulator: HTTP ${response.status}`);
    }

    await Promise.all([
      seedMember("owner-a", "salon-a", "owner"),
      seedMember("staff-a", "salon-a", "staff"),
      seedMember("owner-b", "salon-b", "owner"),
      db.collection("salons").doc("salon-a").set({ name: "Salon A", avatarUrl: null }),
      db.collection("salons").doc("salon-b").set({ name: "Salon B", avatarUrl: null }),
    ]);
  });

  afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("cho owner đúng salon gỡ ảnh và ghi audit không chứa URL", async () => {
    const result = await updateSalonAvatar.run(
      requestFor("owner-a", { salonId: "salon-a", salonAvatarUrl: "" }),
    );

    expect(result).toEqual({ salonAvatarUrl: "" });
    expect((await db.collection("salons").doc("salon-a").get()).data()?.avatarUrl).toBeNull();
    const audits = await db
      .collection("audit_events")
      .where("salonId", "==", "salon-a")
      .where("action", "==", "salon.avatar_removed")
      .get();
    expect(audits.size).toBe(1);
    expect(JSON.stringify(audits.docs[0].data())).not.toContain("firebasestorage");
  });

  it("từ chối staff, owner salon khác và request chưa đăng nhập", async () => {
    await expect(
      updateSalonAvatar.run(requestFor("staff-a", { salonId: "salon-a", salonAvatarUrl: "" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updateSalonAvatar.run(requestFor("owner-b", { salonId: "salon-a", salonAvatarUrl: "" })),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updateSalonAvatar.run({
        data: { salonId: "salon-a", salonAvatarUrl: "" },
        auth: undefined,
        rawRequest: { headers: {}, ip: "127.0.0.1" },
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

function seedMember(uid: string, salonId: string, role: "owner" | "staff") {
  return db
    .collection("users")
    .doc(uid)
    .set({
      salonId,
      role,
      name: role === "owner" ? "Chủ salon" : "Nhân viên",
      isActive: true,
      branchIds: [],
    });
}

function requestFor(uid: string, data: Record<string, unknown>) {
  return {
    data,
    auth: { uid, token: {} },
    rawRequest: { headers: {}, ip: "127.0.0.1" },
  } as never;
}
