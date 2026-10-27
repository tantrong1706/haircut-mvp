import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "../services/auth";
import type { PointRequest } from "../services/operations";
import { defaultLuckyWheelConfig } from "../services/types";
import { OwnerPage } from "./OwnerPage";

vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,fixture" },
}));

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  overview: vi.fn(),
  branches: vi.fn(),
  profile: vi.fn(),
  wheel: vi.fn(),
  saveWheel: vi.fn(),
  saveNote: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  savePhotos: vi.fn(),
}));
vi.mock("../services/operations", () => ({
  listenPendingPointRequests: mocks.subscribe,
  getOwnerOverview: mocks.overview,
  getBranchQrSettings: mocks.branches,
  getSalonProfile: mocks.profile,
  getLuckyWheelConfig: mocks.wheel,
  saveLuckyWheelConfig: mocks.saveWheel,
  approvePointRequest: mocks.approve,
  rejectPointRequest: mocks.reject,
  updatePendingPointRequestPhotos: mocks.savePhotos,
  formatDateTime: (ms: number | null) => (ms ? "Ngày mẫu" : ""),
  listenStaffProfiles: () => () => undefined,
}));
vi.mock("../services/ownerWorkspace", () => ({
  savePendingVisitNote: mocks.saveNote,
  listSalonCustomerDirectory: async () => ({ customers: [], nextCursor: null, totalCount: 0 }),
}));
vi.mock("../services/auth", () => ({
  updateOwnerAvatar: vi.fn(),
  uploadOwnerAvatarFile: vi.fn(),
}));
vi.mock("../services/customerPhotos", () => ({
  MAX_HAIRCUT_PHOTOS: 3,
  uploadHaircutPhoto: mocks.upload,
  deleteHaircutPhoto: mocks.remove,
}));
vi.mock("../services/salonBranding", () => ({
  removeSalonAvatar: vi.fn(),
  uploadSalonAvatarFile: vi.fn(),
}));
vi.mock("../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: (_name: string, operation: () => unknown) => operation(),
}));
vi.mock("../components/AccountDeletionPanel", () => ({ AccountDeletionPanel: () => null }));
vi.mock("../components/RedeemRewardPanel", () => ({ RedeemRewardPanel: () => null }));

const owner: AppUser = {
  uid: "owner-fixture",
  salonId: " salon-fixture ",
  name: "Chủ mẫu",
  role: "owner",
  isActive: true,
};
const branches = ["one", "two"].map((id) => ({
  id,
  salonId: "salon-fixture",
  name: `Chi nhánh ${id}`,
  address: "",
  phone: "",
  qrUrl: "https://example.invalid/qr",
  isActive: true,
}));
const request: PointRequest = {
  id: "request-fixture",
  salonId: "salon-fixture",
  branchId: "one",
  branchName: "Chi nhánh one",
  sessionId: "session-fixture",
  customerId: "customer-fixture",
  staffName: "Thợ mẫu",
  note: "Giữ form",
  photoUrls: [],
  photoPaths: [],
  pointsAdded: 2,
  status: "pending",
  createdAtMs: 1,
  customer: {
    id: "customer-fixture",
    name: "Khách mẫu",
    phoneLast4: "5678",
    points: 7,
    allowPhoto: true,
  },
};

async function openPage() {
  const view = render(<OwnerPage currentUser={owner} />);
  await screen.findByRole("heading", { name: "Salon mẫu" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Làm mới" })).toBeEnabled());
  return view;
}
async function openTab(name: string) {
  await userEvent.setup().click(
    within(screen.getByRole("navigation", { name: "Chọn mục quản lý" })).getByRole("button", {
      name,
      exact: true,
    }),
  );
}

describe("OwnerPage behavior before extraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.subscribe.mockImplementation((_salon, _branch, next) => {
      next(structuredClone([request]));
      return mocks.unsubscribe;
    });
    mocks.overview.mockResolvedValue({
      customersToday: 3,
      customers7Days: 8,
      customers30Days: 20,
      pendingRequests: 1,
      pointsApprovedToday: 2,
      spinsToday: 4,
      unusedRewards: 5,
      inactiveCustomers: [],
    });
    mocks.branches.mockResolvedValue({ branches });
    mocks.profile.mockResolvedValue({
      id: "salon-fixture",
      name: "Salon mẫu",
      address: "",
      phone: "",
      pointPerVisit: 2,
      freeCustomerLimit: 50,
    });
    mocks.wheel.mockResolvedValue(structuredClone(defaultLuckyWheelConfig));
    mocks.saveWheel.mockResolvedValue({ ok: true, configVersion: 9 });
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:fixture");
        static revokeObjectURL = vi.fn();
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not subscribe or load business data without a salon", () => {
    render(<OwnerPage currentUser={{ ...owner, salonId: " " }} />);
    expect(screen.getByText("Tài khoản chưa có salon")).toBeVisible();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(mocks.wheel).not.toHaveBeenCalled();
  });

  it("keeps trimmed salon/branch scope and disposes subscriptions on filter change and unmount", async () => {
    const view = await openPage();
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      "salon-fixture",
      null,
      expect.any(Function),
      expect.any(Function),
    );
    await userEvent.setup().selectOptions(screen.getByLabelText("Chi nhánh đang xem"), "two");
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.subscribe).toHaveBeenLastCalledWith(
      "salon-fixture",
      "two",
      expect.any(Function),
      expect.any(Function),
    );
    expect(mocks.overview).toHaveBeenLastCalledWith("salon-fixture", "two");
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("preserves custom navigation prefixes, unknown-route behavior and listener cleanup", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const view = await openPage();
    const menu = within(screen.getByRole("navigation"));
    const routes = [
      ["/approvals/pending", "Duyệt điểm"],
      ["/branches", "Chi nhánh"],
      ["/staff", "Nhân viên"],
      ["/customers", "Khách hàng"],
      ["/wheel", "Vòng quay"],
      ["/rewards", "Đổi quà"],
      ["/settings", "Cài đặt"],
      ["/delete-account", "Cài đặt"],
      ["/overview", "Tổng quan"],
      ["/queue", "Tổng quan"],
      ["/not-an-owner-route", "Tổng quan"],
    ];
    for (const [route, label] of routes) {
      await act(async () =>
        window.dispatchEvent(new CustomEvent("haircut:navigate", { detail: route })),
      );
      expect(menu.getByRole("button", { name: label, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    const handler = add.mock.calls.find(([event]) => event === "haircut:navigate")?.[1];
    expect(handler).toBeDefined();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("haircut:navigate", handler);
  });

  it("keeps unsaved approval notes across tabs and never approves if saving fails", async () => {
    await openPage();
    await openTab("Duyệt điểm");
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Ghi chú kiểu tóc (không bắt buộc)"));
    await user.type(screen.getByLabelText("Ghi chú kiểu tóc (không bắt buộc)"), "Form mới");
    await openTab("Tổng quan");
    await openTab("Duyệt điểm");
    expect(screen.getByLabelText("Ghi chú kiểu tóc (không bắt buộc)")).toHaveValue("Form mới");
    mocks.saveNote.mockRejectedValue(new Error("Không lưu được ghi chú mẫu"));
    await user.click(screen.getByRole("button", { name: "Duyệt", exact: true }));
    expect(await screen.findByText("Không lưu được ghi chú mẫu")).toBeVisible();
    expect(mocks.saveNote).toHaveBeenCalledWith({
      salonId: "salon-fixture",
      requestId: request.id,
      note: "Form mới",
    });
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves a changed note before confirmation and sends the same request only after explicit approval", async () => {
    await openPage();
    await openTab("Duyệt điểm");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Ghi chú kiểu tóc (không bắt buộc)"), " mới");
    await user.click(screen.getByRole("button", { name: "Duyệt", exact: true }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Cộng 2 điểm cho Khách mẫu");
    expect(mocks.saveNote).toHaveBeenCalledOnce();
    expect(mocks.approve).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Duyệt điểm", exact: true }));
    await screen.findByText("Đã duyệt cộng điểm và lưu lịch sử cắt tóc.");
    // Characterizes the existing captured request, not a new payload contract.
    expect(mocks.approve).toHaveBeenCalledWith(request);
  });

  it("keeps rejection cancellation write-free and displays server errors on explicit rejection", async () => {
    await openPage();
    await openTab("Duyệt điểm");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Từ chối", exact: true }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hủy" }));
    expect(mocks.reject).not.toHaveBeenCalled();
    mocks.reject.mockRejectedValue(new Error("Quyền bị từ chối mẫu"));
    await user.click(screen.getByRole("button", { name: "Từ chối", exact: true }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Từ chối", exact: true }),
    );
    expect(await screen.findByText("Quyền bị từ chối mẫu")).toBeVisible();
    expect(mocks.reject).toHaveBeenCalledWith(request);
  });

  it("keeps consent, photo-read warning and failed upload drafts without approving points", async () => {
    mocks.subscribe.mockImplementation((_salon, _branch, next) => {
      next([{ ...request, photoReadError: true }]);
      return mocks.unsubscribe;
    });
    mocks.upload.mockRejectedValue(new Error("Ảnh lỗi mẫu"));
    await openPage();
    await openTab("Duyệt điểm");
    expect(screen.getByRole("status")).toHaveTextContent("Các ảnh đã lưu vẫn được giữ");
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText("Chọn ảnh kiểu tóc cho Khách mẫu"),
      new File(["fixture"], "fixture.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(await screen.findByText("Ảnh lỗi mẫu")).toBeVisible();
    expect(screen.getByRole("button", { name: "Tải 1 ảnh" })).toBeEnabled();
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-fixture",
        branchId: "one",
        customerId: request.customerId,
        sessionId: request.sessionId,
      }),
    );
    expect(mocks.savePhotos).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("does not enable photo capture without explicit customer consent", async () => {
    mocks.subscribe.mockImplementation((_salon, _branch, next) => {
      next([{ ...request, customer: { ...request.customer, allowPhoto: false } }]);
      return mocks.unsubscribe;
    });
    await openPage();
    await openTab("Duyệt điểm");
    expect(screen.getByLabelText("Chụp ảnh kiểu tóc cho Khách mẫu")).toBeDisabled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("retains wheel edits across tabs, keeps numeric bounds and saves the unchanged contract/version", async () => {
    await openPage();
    await openTab("Vòng quay");
    const user = userEvent.setup();
    const points = screen.getByLabelText("Số điểm cần để quay");
    await user.clear(points);
    await user.type(points, "10001");
    expect(points).toHaveValue(10000);
    await user.clear(screen.getByLabelText("Tên ô 1"));
    await user.type(screen.getByLabelText("Tên ô 1"), "Quà mẫu");
    await openTab("Tổng quan");
    await openTab("Vòng quay");
    expect(screen.getByLabelText("Tên ô 1")).toHaveValue("Quà mẫu");
    await user.click(screen.getByRole("button", { name: "Lưu vòng quay" }));
    await screen.findByText("Đã lưu cấu hình vòng quay.");
    const expected = structuredClone(defaultLuckyWheelConfig);
    expected.requiredPoints = 10000;
    expected.slots[0].label = "Quà mẫu";
    expect(mocks.saveWheel).toHaveBeenLastCalledWith("salon-fixture", expected);
    await user.click(screen.getByRole("button", { name: "Lưu vòng quay" }));
    await waitFor(() => expect(mocks.saveWheel).toHaveBeenCalledTimes(2));
    expect(mocks.saveWheel).toHaveBeenLastCalledWith("salon-fixture", {
      ...expected,
      configVersion: 9,
    });
  });

  it("keeps wheel drafts and existing error text when saving fails", async () => {
    mocks.saveWheel.mockRejectedValue(new Error("Phiên bản cấu hình đã thay đổi mẫu"));
    await openPage();
    await openTab("Vòng quay");
    await userEvent.setup().click(screen.getByRole("button", { name: "Lưu vòng quay" }));
    expect(await screen.findByText("Phiên bản cấu hình đã thay đổi mẫu")).toBeVisible();
    expect(screen.getByRole("button", { name: "Lưu vòng quay" })).toBeEnabled();
  });
});
