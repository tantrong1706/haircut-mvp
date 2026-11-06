import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SalonOperationsPanel } from "./SalonOperationsPanel";

const mock = vi.hoisted(() => ({ salonOperations: vi.fn(), manageSalon: vi.fn() }));
vi.mock("../services/adminApi", () => ({ adminApi: mock }));
const snapshot = {
  salonId: "salon-a",
  salonName: "Salon A",
  status: "active",
  checkedAtMs: 1000,
  writesEnabled: true,
  totalPending: 1,
  nextCursor: null,
  requests: [
    {
      id: "request-a",
      branchId: "branch-a",
      branchName: "Chi nhánh A",
      sessionId: "request-a",
      state: "waiting",
      cancellable: true,
      createdAtMs: 1000,
      expiresAtMs: 2000,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.salonOperations.mockResolvedValue(snapshot);
  mock.manageSalon.mockResolvedValue({ changed: true });
});
const renderPanel = (onChanged = vi.fn()) =>
  render(<SalonOperationsPanel salonId="salon-a" onChanged={onChanged} />);

describe("salon supervision and confirmed controls", () => {
  it("shows queue scope and expired rows separately without claiming they were automatically fixed", async () => {
    mock.salonOperations.mockResolvedValue({
      ...snapshot,
      totalPending: 51,
      nextCursor: "request-a",
      requests: [{ ...snapshot.requests[0], state: "expired" }],
    });
    renderPanel();
    expect(await screen.findByText("Đã hết hạn chờ")).toBeVisible();
    expect(screen.getByText(/Đã tải 1 trong 51 yêu cầu/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Tải thêm yêu cầu" })).toBeVisible();
    expect(mock.manageSalon).not.toHaveBeenCalled();
  });
  it("honors the dedicated server switch and does not expose permanent deletion", async () => {
    mock.salonOperations.mockResolvedValue({ ...snapshot, writesEnabled: false });
    renderPanel();
    expect(await screen.findByRole("button", { name: "Khóa salon" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy yêu cầu request-a" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /xóa vĩnh viễn/i })).not.toBeInTheDocument();
  });
  it("requires exact salon name, reason and acknowledgement; closing preview sends nothing", async () => {
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Khóa salon" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận thao tác" });
    expect(confirm).toBeDisabled();
    await actor.type(screen.getByLabelText("Tên salon xác nhận thao tác"), "Wrong salon");
    await actor.type(screen.getByLabelText("Lý do thao tác"), "Kiểm tra quản trị trên dữ liệu giả");
    await actor.click(screen.getByRole("checkbox", { name: /Tôi hiểu phạm vi thao tác/ }));
    expect(confirm).toBeDisabled();
    await actor.click(screen.getByRole("button", { name: "Đóng, không thực hiện" }));
    expect(mock.manageSalon).not.toHaveBeenCalled();
  });
  it("sends one scoped cancellation and refreshes only after success", async () => {
    const actor = userEvent.setup(),
      changed = vi.fn();
    renderPanel(changed);
    await actor.click(await screen.findByRole("button", { name: "Hủy yêu cầu request-a" }));
    expect(screen.getByRole("region", { name: "Xem trước thao tác quản trị" })).toHaveTextContent(
      "request-a",
    );
    await actor.type(screen.getByLabelText("Tên salon xác nhận thao tác"), "Salon A");
    await actor.type(screen.getByLabelText("Lý do thao tác"), "Hủy yêu cầu thử đã được đối chiếu");
    await actor.click(screen.getByRole("checkbox", { name: /Tôi hiểu phạm vi thao tác/ }));
    await actor.click(screen.getByRole("button", { name: "Xác nhận thao tác" }));
    await waitFor(() => expect(mock.manageSalon).toHaveBeenCalledTimes(1));
    expect(mock.manageSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-a",
        action: "cancel_point_request",
        expectedStatus: "active",
        requestId: "request-a",
        operationId: expect.any(String),
      }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  });
  it("does not turn a service error into an empty healthy queue", async () => {
    mock.salonOperations.mockRejectedValue({ code: "functions/unavailable" });
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được yêu cầu");
    expect(screen.queryByText("Không có yêu cầu đang chờ.")).not.toBeInTheDocument();
  });
  it("refuses to render a result for another salon", async () => {
    mock.salonOperations.mockResolvedValue({ ...snapshot, salonId: "salon-b" });
    renderPanel();
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Khóa salon" })).not.toBeInTheDocument();
  });
  it("does not allow cancellation of inconsistent requests or changes to pending-deletion salons", async () => {
    mock.salonOperations.mockResolvedValue({
      ...snapshot,
      status: "pending_deletion",
      requests: [{ ...snapshot.requests[0], state: "inconsistent", cancellable: false }],
    });
    renderPanel();
    expect(await screen.findByText("Cần đối chiếu dữ liệu")).toBeVisible();
    expect(screen.getByRole("button", { name: "Hủy yêu cầu request-a" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Mở lại salon" })).not.toBeInTheDocument();
  });
  it("ignores an old response when a different salon is selected", async () => {
    let resolveOld!: (value: unknown) => void;
    mock.salonOperations.mockImplementation((id: string) =>
      id === "salon-a"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve({
            ...snapshot,
            salonId: "salon-b",
            salonName: "Salon B",
            requests: [],
            totalPending: 0,
          }),
    );
    const view = renderPanel();
    view.rerender(<SalonOperationsPanel salonId="salon-b" onChanged={vi.fn()} />);
    await screen.findByText("Không có yêu cầu đang chờ.");
    await act(async () => resolveOld(snapshot));
    expect(screen.queryByText("request-a")).not.toBeInTheDocument();
  });
});
