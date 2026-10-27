import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import { AdminDashboard } from "./AdminDashboard";

const mock = vi.hoisted(() => ({
  overview: vi.fn(),
  salons: vi.fn(),
  features: vi.fn(),
  auditEvents: vi.fn(),
  diagnostics: vi.fn(),
  repair: vi.fn(),
  access: vi.fn(),
}));
vi.mock("../services/adminApi", () => ({ adminApi: mock }));
vi.mock("../services/firebase", () => ({ auth: {}, firebaseProjectId: "fixture-project" }));
vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));

const user = { uid: "fixture-admin", email: "admin@example.test" } as User;
const salon = {
  id: "salon-a",
  name: "Salon A",
  status: "active",
  plan: "free",
  customerCount: 99,
  ownerId: "owner-a",
  updatedAtMs: null,
};
const flags = {
  checkinEnabled: true,
  pointApprovalEnabled: true,
  photoUploadEnabled: true,
  luckyWheelEnabled: true,
  rewardRedeemEnabled: true,
  maintenanceMode: false,
  minimumSupportedAppVersion: "",
  recommendedAppVersion: "",
};
const diagnostic = {
  salonId: "salon-a",
  salonName: "Salon A",
  status: "active",
  repairsEnabled: true,
  checkedAtMs: Date.now(),
  customerCount: { stored: 99, actual: 2 },
  activeBranches: 1,
  features: flags,
  pointerScan: { checked: 0, hasMore: false },
  stalePointers: [],
  issues: [
    {
      code: "CUSTOMER_COUNT_MISMATCH",
      severity: "warning",
      message: "Bộ đếm khách không khớp số hồ sơ thực tế.",
      action: "reconcile_customer_count",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.overview.mockResolvedValue({
    salons: { total: 2, active: 2, suspended: 0, pendingDeletion: 0 },
    users: { owners: 2, staff: 1 },
    operations: { pendingPointRequests: 0, openSessions: 0 },
  });
  mock.salons.mockResolvedValue({ salons: [salon], nextCursor: null });
  mock.features.mockResolvedValue({ features: flags });
  mock.auditEvents.mockResolvedValue({ events: [] });
  mock.diagnostics.mockResolvedValue(diagnostic);
  mock.repair.mockResolvedValue({
    changed: true,
    action: "reconcile_customer_count",
    salonId: "salon-a",
  });
});

async function openSalon() {
  const actor = userEvent.setup();
  render(<AdminDashboard user={user} />);
  await actor.click(screen.getByRole("button", { name: /^Salon$/ }));
  await actor.click(await screen.findByRole("button", { name: "Kiểm tra Salon A" }));
  await screen.findByText("Bộ đếm khách không khớp số hồ sơ thực tế.");
  return actor;
}

describe("all-salon operations dashboard", () => {
  it("starts a guided salon inspection without scanning salons or writing automatically", async () => {
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(await screen.findByRole("button", { name: "Kiểm tra một salon" }));
    expect(await screen.findByRole("heading", { name: "Danh sách salon" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Quy trình xử lý" })).toHaveTextContent("Xem trước");
    expect(mock.diagnostics).not.toHaveBeenCalled();
    expect(mock.repair).not.toHaveBeenCalled();
    await actor.click(screen.getByRole("button", { name: "Kiểm tra Salon A" }));
    expect(screen.getByRole("button", { name: "Kiểm tra Salon A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByRole("heading", { name: "Kiểm tra Salon A" })).toHaveFocus();
  });
  it("exposes an unavailable section across tabs and offers an explicit retry", async () => {
    mock.overview.mockRejectedValue({ code: "functions/unavailable" });
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    expect(await screen.findByRole("region", { name: "Tình trạng dữ liệu" })).toHaveTextContent(
      "Tổng quan chưa tải được",
    );
    await actor.click(screen.getByRole("button", { name: "Thử tải lại" }));
    await waitFor(() => expect(mock.overview).toHaveBeenCalledTimes(2));
    expect(mock.repair).not.toHaveBeenCalled();
  });
  it("explains common incidents and routes back to salon checks without enabling writes", async () => {
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(screen.getByRole("button", { name: "Sự cố" }));
    expect(screen.getByRole("heading", { name: "Ảnh hoặc ghi chú không lưu" })).toBeVisible();
    expect(screen.getByText(/Không cộng bù điểm trực tiếp/)).toBeVisible();
    await actor.click(screen.getByRole("button", { name: "Chọn salon để kiểm tra" }));
    expect(await screen.findByRole("heading", { name: "Danh sách salon" })).toBeVisible();
    expect(mock.repair).not.toHaveBeenCalled();
  });
  it("loads additional salon pages instead of hiding everything after the first 50", async () => {
    mock.salons
      .mockResolvedValueOnce({ salons: [salon], nextCursor: "cursor-a" })
      .mockResolvedValueOnce({
        salons: [{ ...salon, id: "salon-b", name: "Salon B" }],
        nextCursor: null,
      });
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(screen.getByRole("button", { name: /^Salon$/ }));
    await actor.click(await screen.findByRole("button", { name: "Tải thêm salon" }));
    expect(await screen.findByText("Salon B")).toBeVisible();
    expect(mock.salons).toHaveBeenLastCalledWith("cursor-a");
  });
  it("keeps a usable salon list even if the overview service fails", async () => {
    mock.overview.mockRejectedValue(new Error("functions/unavailable"));
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(screen.getByRole("button", { name: /^Salon$/ }));
    expect(await screen.findByRole("button", { name: "Kiểm tra Salon A" })).toBeVisible();
  });
  it("does not present a failed list request as no salons", async () => {
    mock.salons.mockRejectedValue(new Error("functions/internal"));
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(screen.getByRole("button", { name: /^Salon$/ }));
    expect(await screen.findByText(/Chưa tải được danh sách salon/)).toBeVisible();
    expect(screen.queryByText("Chưa có salon")).not.toBeInTheDocument();
  });
  it("requires review, exact salon name, reason and explicit acknowledgement before a repair", async () => {
    const actor = await openSalon();
    await actor.click(screen.getByRole("button", { name: "Đồng bộ bộ đếm khách" }));
    const apply = screen.getByRole("button", { name: "Xác nhận sửa" });
    expect(apply).toBeDisabled();
    await actor.type(screen.getByLabelText("Nhập tên salon để xác nhận"), "Salon A");
    await actor.type(screen.getByLabelText("Lý do sửa"), "Đối chiếu hồ sơ thực tế");
    expect(apply).toBeDisabled();
    await actor.click(screen.getByRole("checkbox", { name: /Tôi đã kiểm tra đúng salon/ }));
    await actor.click(apply);
    await waitFor(() => expect(mock.repair).toHaveBeenCalledTimes(1));
    expect(mock.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-a",
        action: "reconcile_customer_count",
        expectedStoredCount: 99,
        expectedActualCount: 2,
        confirmedSalonName: "Salon A",
        reason: "Đối chiếu hồ sơ thực tế",
        operationId: expect.any(String),
      }),
    );
  });
  it("keeps repairs disabled when the server disables the dedicated capability", async () => {
    mock.diagnostics.mockResolvedValue({ ...diagnostic, repairsEnabled: false });
    await openSalon();
    expect(screen.getByRole("button", { name: "Đồng bộ bộ đếm khách" })).toBeDisabled();
    expect(mock.repair).not.toHaveBeenCalled();
  });
  it("ignores a late diagnostic response after another salon is selected", async () => {
    mock.salons.mockResolvedValue({
      salons: [salon, { ...salon, id: "salon-b", name: "Salon B" }],
      nextCursor: null,
    });
    let completeA!: (value: unknown) => void;
    mock.diagnostics.mockImplementation((id: string) =>
      id === "salon-a"
        ? new Promise((resolve) => {
            completeA = resolve;
          })
        : Promise.resolve({ ...diagnostic, salonId: "salon-b", salonName: "Salon B", issues: [] }),
    );
    const actor = userEvent.setup();
    render(<AdminDashboard user={user} />);
    await actor.click(screen.getByRole("button", { name: /^Salon$/ }));
    await actor.click(await screen.findByRole("button", { name: "Kiểm tra Salon A" }));
    await actor.click(screen.getByRole("button", { name: "Kiểm tra Salon B" }));
    await screen.findByRole("heading", { name: "Kiểm tra Salon B" });
    await act(async () => completeA(diagnostic));
    expect(screen.getByRole("heading", { name: "Kiểm tra Salon B" })).toBeVisible();
    expect(screen.queryByText("Bộ đếm khách không khớp số hồ sơ thực tế.")).not.toBeInTheDocument();
  });
});
