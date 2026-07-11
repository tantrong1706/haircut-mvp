import { describe, expect, it } from "vitest";
import { clearSavedSession, loadSavedSession, saveSession } from "./sessionStore";
import type { AppSession, QrContext } from "./types";

const qr: QrContext = { salonId: "salon-a", mirrorId: "mirror-a", qrToken: "token-a" };
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
  it("chỉ khôi phục session thuộc đúng QR", () => {
    saveSession(session);

    expect(loadSavedSession(qr)).toEqual(session);
    expect(loadSavedSession({ ...qr, qrToken: "token-khac" })).toBeNull();
  });

  it("xóa session đã lưu", () => {
    saveSession(session);
    clearSavedSession();
    expect(loadSavedSession(qr)).toBeNull();
  });

  it("không khôi phục phiên demo trên bản production", () => {
    saveSession({
      ...session,
      qr: { salonId: "demo-salon", mirrorId: "demo-mirror-1", qrToken: "demo-token" },
    });

    expect(
      loadSavedSession({
        salonId: "demo-salon",
        mirrorId: "demo-mirror-1",
        qrToken: "demo-token",
      }),
    ).toBeNull();
  });
});
