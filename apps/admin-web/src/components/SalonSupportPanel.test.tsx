import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { SalonSupportPanel } from "./SalonSupportPanel";
import type { AdminDiagnostics, AdminSalon } from "../services/adminApi";

const mock = vi.hoisted(() => ({ diagnostics: vi.fn(), repair: vi.fn() }));
vi.mock("../services/adminApi", () => ({ adminApi: mock }));
const salon = { id: "salon-a", name: "Salon A", status: "active" } as AdminSalon;
const data: AdminDiagnostics = {
  salonId: "salon-a",
  salonName: "Salon A",
  status: "active",
  checkedAtMs: 1,
  repairsEnabled: true,
  customerCount: { stored: 9, actual: 2 },
  activeBranches: 1,
  features: {
    checkinEnabled: true,
    pointApprovalEnabled: true,
    photoUploadEnabled: true,
    luckyWheelEnabled: true,
    rewardRedeemEnabled: true,
    maintenanceMode: false,
    minimumSupportedAppVersion: "",
    recommendedAppVersion: "",
  },
  issues: [
    {
      code: "CUSTOMER_COUNT_MISMATCH",
      severity: "warning",
      message: "Sai bộ đếm",
      action: "reconcile_customer_count",
    },
  ],
  stalePointers: [],
  pointerScan: { checked: 0, hasMore: false },
};
const repaired = vi.fn();
const closed = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mock.diagnostics.mockResolvedValue(data);
  mock.repair.mockResolvedValue({ changed: true });
});
function renderPanel() {
  return render(<SalonSupportPanel salon={salon} onClose={closed} onRepaired={repaired} />);
}
async function completeForm(actor: ReturnType<typeof userEvent.setup>) {
  await actor.type(screen.getByLabelText("Nhập tên salon để xác nhận"), "Salon A");
  await actor.type(screen.getByLabelText("Lý do sửa"), "Đối chiếu hồ sơ thực tế");
  await actor.click(screen.getByRole("checkbox", { name: /Tôi đã kiểm tra đúng salon/ }));
}

it("shows partial-scan bounds and never calls incomplete data globally healthy", async () => {
  mock.diagnostics.mockResolvedValue({
    ...data,
    issues: [],
    customerCount: { stored: null, actual: 2 },
    pointerScan: { checked: 50, hasMore: true },
  });
  renderPanel();
  expect(await screen.findByText(/Không phát hiện bất thường trong phạm vi/)).toBeVisible();
  expect(screen.getByText(/Chỉ kiểm tra 50 liên kết đầu/)).toBeVisible();
  expect(screen.getByText("Không hợp lệ")).toBeVisible();
});
it("shows manual issues and disables a pending-deletion salon repair", async () => {
  mock.diagnostics.mockResolvedValue({
    ...data,
    status: "pending_deletion",
    issues: [
      ...data.issues,
      { code: "OWNER_UNAVAILABLE", severity: "error", message: "Thiếu chủ salon", action: null },
    ],
  });
  renderPanel();
  expect(await screen.findByText("Thiếu chủ salon")).toBeVisible();
  expect(screen.getByRole("button", { name: "Đồng bộ bộ đếm khách" })).toBeDisabled();
});
it("retries a failed diagnostic without showing sensitive backend content", async () => {
  mock.diagnostics
    .mockRejectedValueOnce(new Error("PRIVATE_TOKEN secret-value"))
    .mockResolvedValueOnce(data);
  const actor = userEvent.setup();
  renderPanel();
  expect(await screen.findByRole("alert")).not.toHaveTextContent("PRIVATE_TOKEN");
  await actor.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
  expect(await screen.findByText("Sai bộ đếm")).toBeVisible();
});
it("can cancel a pointer-repair confirmation without a write", async () => {
  mock.diagnostics.mockResolvedValue({
    ...data,
    stalePointers: [{ pointerId: "pointer-a", sessionId: "session-a", customerId: "customer-a" }],
  });
  const actor = userEvent.setup();
  renderPanel();
  await actor.click(await screen.findByRole("button", { name: "Gỡ liên kết lượt session-a" }));
  expect(screen.getByText(/Chỉ gỡ liên kết của lượt session-a/)).toBeVisible();
  await actor.click(screen.getByRole("button", { name: "Hủy, không thay đổi" }));
  expect(screen.queryByRole("form", { name: "Xác nhận sửa dữ liệu" })).not.toBeInTheDocument();
  expect(mock.repair).not.toHaveBeenCalled();
  await actor.click(screen.getByRole("button", { name: "Đóng kiểm tra" }));
  expect(closed).toHaveBeenCalledOnce();
});
it("submits a selected pointer only after the same confirmation safeguards", async () => {
  mock.diagnostics.mockResolvedValue({
    ...data,
    stalePointers: [{ pointerId: "pointer-a", sessionId: "session-a", customerId: "customer-a" }],
  });
  const actor = userEvent.setup();
  renderPanel();
  await actor.click(await screen.findByRole("button", { name: "Gỡ liên kết lượt session-a" }));
  await completeForm(actor);
  await actor.click(screen.getByRole("button", { name: "Xác nhận sửa" }));
  await waitFor(() =>
    expect(mock.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "clear_stale_session_pointer",
        pointerId: "pointer-a",
        expectedSessionId: "session-a",
      }),
    ),
  );
  expect(repaired).toHaveBeenCalledOnce();
});
it("retains the operation key after an ambiguous network failure so retry cannot double-apply", async () => {
  mock.repair
    .mockRejectedValueOnce({ code: "functions/unavailable" })
    .mockResolvedValueOnce({ changed: true });
  const actor = userEvent.setup();
  renderPanel();
  await actor.click(await screen.findByRole("button", { name: "Đồng bộ bộ đếm khách" }));
  await completeForm(actor);
  await actor.click(screen.getByRole("button", { name: "Xác nhận sửa" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa kết nối/);
  await actor.click(screen.getByRole("button", { name: "Xác nhận sửa" }));
  await waitFor(() => expect(repaired).toHaveBeenCalledOnce());
  expect(mock.repair.mock.calls[0][0].operationId).toBe(mock.repair.mock.calls[1][0].operationId);
});
it("prevents double submission while busy and ignores completion after leaving the panel", async () => {
  let complete!: (value: unknown) => void;
  mock.repair.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const actor = userEvent.setup();
  const view = renderPanel();
  await actor.click(await screen.findByRole("button", { name: "Đồng bộ bộ đếm khách" }));
  await completeForm(actor);
  await actor.click(screen.getByRole("button", { name: "Xác nhận sửa" }));
  expect(screen.getByRole("button", { name: "Đang xử lý…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Kiểm tra lại" })).toBeDisabled();
  expect(mock.repair).toHaveBeenCalledOnce();
  view.unmount();
  await act(async () => complete({ changed: true }));
  expect(repaired).not.toHaveBeenCalled();
});
