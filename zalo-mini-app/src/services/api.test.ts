import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRegisterInput,
  customerSessionRefreshDelay,
  getHaircutHistory,
  resolveCustomerQr,
  restoreSavedCustomerSession,
  spinWheel,
} from "./api";
import { createSessionIdentityBinding, type SavedSessionCandidate } from "./sessionStore";

const mocks = vi.hoisted(() => ({
  callFunction: vi.fn(),
  getZaloAccessToken: vi.fn(),
  getZaloIdentity: vi.fn(),
  isFirebaseConfigured: vi.fn(() => false),
}));

vi.mock("./firebase", () => ({
  callFunction: mocks.callFunction,
  getFirebaseDb: vi.fn(() => null),
  getFunctionWriteMode: vi.fn(() => "required"),
  isFirebaseConfigured: mocks.isFirebaseConfigured,
}));

vi.mock("./zalo", () => ({
  getZaloAccessToken: mocks.getZaloAccessToken,
  getZaloIdentity: mocks.getZaloIdentity,
}));

const candidate: SavedSessionCandidate = {
  schemaVersion: 2,
  salonId: "salon-a",
  sessionId: "session-a",
  customerId: "customer-a",
  identityBinding: "a".repeat(64),
  savedAt: 1,
  expiresAt: 2,
  qr: {
    qrType: "branch",
    salonId: "salon-a",
    branchId: "branch-a",
    mirrorId: "",
  },
};

function backendSession(overrides: Record<string, unknown> = {}) {
  return {
    identityBinding: "a".repeat(64),
    sessionStatus: "waiting",
    branchId: "branch-a",
    branchName: "Chi nhánh A",
    branchAddress: "Địa chỉ A",
    assignedStaffName: "",
    claimedAtMs: null,
    customer: {
      customerId: "customer-a",
      name: "Khách A",
      phoneLast4: "1234",
      points: 3,
      allowPhoto: false,
    },
    wheelConfig: {
      requiredPoints: 5,
      deductPointsAfterSpin: true,
      slots: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.callFunction.mockReset();
  vi.clearAllMocks();
  mocks.isFirebaseConfigured.mockReturnValue(false);
  mocks.getZaloAccessToken.mockResolvedValue("fresh-zalo-token");
  mocks.getZaloIdentity.mockResolvedValue({
    zaloUserId: "preview-zalo-user",
    accessToken: "preview-zalo-token",
    name: "Khách xem trước",
    avatar: "",
  });
});

describe("customerSessionRefreshDelay", () => {
  it("dừng polling khi lượt đã kết thúc", () => {
    expect(customerSessionRefreshDelay("completed", 0, 0)).toBeNull();
    expect(customerSessionRefreshDelay("cancelled", 0, 0)).toBeNull();
  });

  it("giảm tần suất khi chờ duyệt và backoff sau lỗi", () => {
    expect(customerSessionRefreshDelay("waiting", 0, 0)).toBe(20_000);
    expect(customerSessionRefreshDelay("pending_approval", 0, 0)).toBe(30_000);
    expect(customerSessionRefreshDelay("waiting", 2, 0)).toBe(80_000);
  });
});

describe("resolveCustomerQr ở chế độ xem trước", () => {
  it("QR salon yêu cầu chọn khi có nhiều chi nhánh", async () => {
    const result = await resolveCustomerQr({
      qrType: "salon",
      salonId: "demo-salon",
      branchId: "",
      mirrorId: "",
      qrToken: "demo-token",
    });

    expect(result.selectionRequired).toBe(true);
    expect(result.branchId).toBe("");
    expect(result.branches).toHaveLength(2);
  });

  it("QR chi nhánh mở thẳng đúng tên và địa chỉ", async () => {
    const result = await resolveCustomerQr({
      qrType: "branch",
      salonId: "demo-salon",
      branchId: "demo-branch-main",
      mirrorId: "",
      qrToken: "demo-token",
    });

    expect(result.selectionRequired).toBe(false);
    expect(result.branchName).toBe("Chi nhánh Trung tâm");
    expect(result.branchAddress).toContain("Nguyễn Huệ");
  });
});

describe("buildRegisterInput", () => {
  it("không gửi các trường tùy chọn undefined qua Firebase callable", () => {
    const input = buildRegisterInput(
      {
        qrType: "salon",
        salonId: "salon-a",
        branchId: "branch-a",
        mirrorId: "",
        qrToken: "signed-qr-token",
      },
      {
        accessToken: "zalo-access-token",
        name: "Khach A",
      },
      true,
    );

    expect(input).not.toHaveProperty("zaloUserId");
    expect(input).not.toHaveProperty("phoneToken");
    expect(input).not.toHaveProperty("phone");
  });
});

describe("restoreSavedCustomerSession", () => {
  beforeEach(() => {
    mocks.isFirebaseConfigured.mockReturnValue(true);
  });

  it("chỉ khôi phục dữ liệu backend sau khi identity binding khớp", async () => {
    mocks.callFunction.mockResolvedValue(backendSession());

    const result = await restoreSavedCustomerSession(candidate);

    expect(result).toMatchObject({
      status: "restored",
      session: {
        sessionId: "session-a",
        identityBinding: "a".repeat(64),
        customer: { customerId: "customer-a", name: "Khách A", points: 3 },
      },
    });
    expect(mocks.callFunction).toHaveBeenCalledWith("getCustomerSessionFromZalo", {
      salonId: "salon-a",
      sessionId: "session-a",
      zaloAccessToken: "fresh-zalo-token",
    });
  });

  it("loại cache khi Zalo hiện tại không khớp identity binding", async () => {
    mocks.callFunction.mockResolvedValue(backendSession({ identityBinding: "b".repeat(64) }));

    await expect(restoreSavedCustomerSession(candidate)).resolves.toEqual({
      status: "discarded",
      reason: "identity_mismatch",
    });
  });

  it.each(["completed", "cancelled"])("loại session terminal %s", async (sessionStatus) => {
    mocks.callFunction.mockResolvedValue(backendSession({ sessionStatus }));

    await expect(restoreSavedCustomerSession(candidate)).resolves.toEqual({
      status: "discarded",
      reason: "terminal_session",
    });
  });

  it("loại cache khi backend xác nhận session không còn tồn tại", async () => {
    mocks.callFunction.mockRejectedValue(new Error("Không tìm thấy dữ liệu cần xử lý."));

    await expect(restoreSavedCustomerSession(candidate)).resolves.toEqual({
      status: "discarded",
      reason: "session_missing",
    });
  });

  it("giữ lỗi mạng để UI cho retry mà không dùng dữ liệu cache", async () => {
    mocks.callFunction.mockRejectedValue(new Error("Kết nối hệ thống đang chậm."));

    await expect(restoreSavedCustomerSession(candidate)).rejects.toThrow(
      "Kết nối hệ thống đang chậm.",
    );
  });
});

describe("restoreSavedCustomerSession ở chế độ kiểm thử", () => {
  it("chỉ khôi phục fixture tối thiểu khi danh tính xem trước khớp", async () => {
    const identityBinding = await createSessionIdentityBinding("preview-zalo-user");
    const previewCandidate: SavedSessionCandidate = {
      ...candidate,
      customerId: "mock-customer",
      identityBinding: identityBinding!,
    };

    const result = await restoreSavedCustomerSession(previewCandidate);

    expect(result).toMatchObject({
      status: "restored",
      session: {
        sessionId: "session-a",
        identityBinding,
        customer: {
          customerId: "mock-customer",
          name: "Khách xem trước",
        },
      },
    });
    expect(mocks.callFunction).not.toHaveBeenCalled();
  });

  it("loại fixture xem trước thuộc tài khoản khác", async () => {
    await expect(
      restoreSavedCustomerSession({
        ...candidate,
        customerId: "mock-customer",
        identityBinding: "b".repeat(64),
      }, 3),
    ).resolves.toEqual({ status: "discarded", reason: "identity_mismatch" });
  });
});

describe("getHaircutHistory", () => {
  it("giữ metadata và ảnh mà callable trả về cho đúng record", async () => {
    mocks.isFirebaseConfigured.mockReturnValue(true);
    mocks.callFunction.mockResolvedValue({
      records: [
        {
          id: "record-a",
          createdAtMs: new Date("2026-07-12T07:30:00.000Z").getTime(),
          salonName: "CH Haircut Salon",
          branchId: "branch-a",
          branchName: "Chi nhánh Quận 1",
          staffName: "Nam",
          serviceName: "Cắt tạo kiểu",
          rewardName: "",
          note: "Fade thấp",
          photoUrls: ["https://firebasestorage.googleapis.com/photo-a.jpg"],
          pointsAdded: 2,
        },
      ],
    });

    const result = await getHaircutHistory({
      qr: candidate.qr,
      sessionId: candidate.sessionId,
      zaloUserId: "zalo-a",
      customer: {
        customerId: candidate.customerId,
        name: "Khách A",
        points: 3,
        allowPhoto: true,
      },
    });

    expect(result[0]).toMatchObject({
      id: "record-a",
      salonName: "CH Haircut Salon",
      branchId: "branch-a",
      branchName: "Chi nhánh Quận 1",
      staffName: "Nam",
      serviceName: "Cắt tạo kiểu",
      photoUrls: ["https://firebasestorage.googleapis.com/photo-a.jpg"],
    });
    expect(mocks.callFunction).toHaveBeenCalledWith("getCustomerHistoryFromZalo", {
      salonId: "salon-a",
      zaloAccessToken: "fresh-zalo-token",
      limit: 20,
    });
  });
});

describe("spinWheel", () => {
  it("dùng fixture xác định trong preview khi không có backend", async () => {
    mocks.isFirebaseConfigured.mockReturnValue(false);

    await expect(
      spinWheel(
        {
          qr: candidate.qr,
          sessionId: candidate.sessionId,
          zaloUserId: "zalo-a",
          customer: {
            customerId: candidate.customerId,
            name: "Khách A",
            points: 10,
            allowPhoto: false,
          },
        },
        3,
      ),
    ).resolves.toMatchObject({ selectedIndex: 1 });
    expect(mocks.callFunction).not.toHaveBeenCalled();
  });

  it("chỉ dùng kết quả callable backend khi Firebase được cấu hình", async () => {
    mocks.isFirebaseConfigured.mockReturnValue(true);
    mocks.callFunction.mockResolvedValue({
      rewardId: "reward-a",
      rewardName: "Quà backend",
      rewardCode: "BACKEND-CODE",
      pointsAfter: 5,
      isWinning: true,
      selectedIndex: 3,
      selectedSlotId: "slot-4",
      configVersion: 3,
    });

    const result = await spinWheel(
      {
        qr: candidate.qr,
        sessionId: candidate.sessionId,
        zaloUserId: "zalo-a",
        customer: {
          customerId: candidate.customerId,
          name: "Khách A",
          points: 10,
          allowPhoto: false,
        },
      },
      3,
    );

    expect(result).toMatchObject({ rewardName: "Quà backend", selectedIndex: 3 });
    expect(mocks.callFunction).toHaveBeenCalledWith(
      "spinLuckyWheelFromZalo",
      expect.objectContaining({
        salonId: "salon-a",
        zaloAccessToken: "fresh-zalo-token",
        idempotencyKey: expect.any(String),
        configVersion: 3,
      }),
    );
  });
});
