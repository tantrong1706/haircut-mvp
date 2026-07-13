import { describe, expect, it } from "vitest";
import { clearSavedSession, loadSavedSession, saveSession } from "./sessionStore";
import type { AppSession, QrContext } from "./types";

const qr: QrContext = {
  qrType: "branch",
  salonId: "salon-a",
  branchId: "branch-a",
  mirrorId: "",
  qrToken: "token-a",
};
const session: AppSession = {
  qr,
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  sessionStatus: "waiting",
  customer: {
    customerId: "customer-a",
    name: "Anh Tân",
    phoneLast4: "1234",
    points: 3,
    allowPhoto: false,
  },
};

describe("sessionStore", () => {
  it("khôi phục phiên cùng salon khi khách quét lại và không lưu token", () => {
    saveSession(session);

    const restored = loadSavedSession({ ...qr, branchId: "branch-b", qrToken: "token-khac" });
    expect(restored).toMatchObject({ sessionId: "session-a", customer: session.customer });
    expect(restored?.qr).toEqual({
      qrType: "branch",
      salonId: "salon-a",
      branchId: "branch-a",
      mirrorId: "",
    });
    expect(localStorage.getItem("haircut_app_session_v1")).not.toContain("token-a");
    expect(loadSavedSession({ ...qr, salonId: "salon-b" })).toBeNull();
  });

  it("xóa session đã lưu", () => {
    saveSession(session);
    clearSavedSession();
    expect(loadSavedSession(qr)).toBeNull();
  });

  it("không khôi phục phiên demo trên bản production", () => {
    saveSession({
      ...session,
      qr: {
        qrType: "legacy-mirror",
        salonId: "demo-salon",
        branchId: "",
        mirrorId: "demo-mirror-1",
        qrToken: "demo-token",
      },
    });

    expect(
      loadSavedSession({
        salonId: "demo-salon",
        qrType: "legacy-mirror",
        branchId: "",
        mirrorId: "demo-mirror-1",
        qrToken: "demo-token",
      }),
    ).toBeNull();
  });
});
