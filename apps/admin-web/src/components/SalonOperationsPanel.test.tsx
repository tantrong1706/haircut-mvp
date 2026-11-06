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
  async function confirmAction(actor: ReturnType<typeof userEvent.setup>) {
    await actor.type(screen.getByLabelText("Tên salon xác nhận thao tác"), "Salon A");
    await actor.type(
      screen.getByLabelText("Lý do thao tác"),
      "Đã đối chiếu phạm vi trên dữ liệu thử",
    );
    await actor.click(screen.getByRole("checkbox", { name: /Tôi hiểu phạm vi thao tác/ }));
    await actor.click(screen.getByRole("button", { name: "Xác nhận thao tác" }));
  }
  it("loads additional pages without duplicating rows and stops repeated cursors", async () => {
    mock.salonOperations
      .mockResolvedValueOnce({ ...snapshot, nextCursor: "request-a", totalPending: 2 })
      .mockResolvedValueOnce({
        ...snapshot,
        nextCursor: "request-a",
        totalPending: 2,
        requests: [
          snapshot.requests[0],
          { ...snapshot.requests[0], id: "request-b", state: "unknown" },
        ],
      });
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Tải thêm yêu cầu" }));
    expect(await screen.findByText("Chưa rõ hạn chờ")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Hủy yêu cầu request-a" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Tải thêm yêu cầu" })).not.toBeInTheDocument();
    expect(mock.salonOperations).toHaveBeenLastCalledWith("salon-a", "request-a");
  });
  it("keeps existing rows when another page fails, allowing an explicit retry", async () => {
    mock.salonOperations
      .mockResolvedValueOnce({ ...snapshot, nextCursor: "request-a" })
      .mockRejectedValueOnce({ code: "functions/unavailable" })
      .mockResolvedValue(snapshot);
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Tải thêm yêu cầu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được trang tiếp theo");
    expect(screen.getByRole("button", { name: "Hủy yêu cầu request-a" })).toBeVisible();
    await actor.click(screen.getByRole("button", { name: "Tải thêm yêu cầu" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
  it("does not append another tenant's response from a later page", async () => {
    mock.salonOperations
      .mockResolvedValueOnce({ ...snapshot, nextCursor: "request-a" })
      .mockResolvedValueOnce({
        ...snapshot,
        salonId: "salon-b",
        requests: [{ ...snapshot.requests[0], id: "private-other-request" }],
      });
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Tải thêm yêu cầu" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("private-other-request")).not.toBeInTheDocument();
  });
  it("reactivates only a suspended salon and explains that requests are not resurrected", async () => {
    mock.salonOperations.mockResolvedValue({ ...snapshot, status: "suspended" });
    mock.manageSalon.mockResolvedValue({ changed: false });
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Mở lại salon" }));
    expect(screen.getByRole("region", { name: "Xem trước thao tác quản trị" })).toHaveTextContent(
      "Không khôi phục yêu cầu đã hủy",
    );
    await confirmAction(actor);
    expect(await screen.findByText(/Không có thay đổi cần ghi/)).toBeVisible();
    expect(mock.manageSalon).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reactivate_salon", expectedStatus: "suspended" }),
    );
  });
  it("retains the same operation id when retrying a transport failure", async () => {
    mock.manageSalon
      .mockRejectedValueOnce({ code: "functions/unavailable" })
      .mockResolvedValueOnce({ changed: true });
    const actor = userEvent.setup(),
      changed = vi.fn();
    renderPanel(changed);
    await actor.click(await screen.findByRole("button", { name: "Khóa salon" }));
    await confirmAction(actor);
    await screen.findByRole("alert");
    expect(changed).not.toHaveBeenCalled();
    const first = mock.manageSalon.mock.calls[0][0];
    await actor.click(screen.getByRole("button", { name: "Xác nhận thao tác" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(mock.manageSalon.mock.calls[1][0]).toEqual(first);
  });
  it("locks confirmation and refresh while a write is pending", async () => {
    let finish!: (value: unknown) => void;
    mock.manageSalon.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    renderPanel();
    await actor.click(await screen.findByRole("button", { name: "Khóa salon" }));
    await confirmAction(actor);
    expect(screen.getByRole("button", { name: "Đang thực hiện…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại yêu cầu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đóng, không thực hiện" })).toBeDisabled();
    await act(async () => finish({ changed: true }));
    expect(mock.manageSalon).toHaveBeenCalledOnce();
  });
  it("does not run old completion callbacks after the operator changes salons", async () => {
    let finish!: (value: unknown) => void;
    mock.manageSalon.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup(),
      changed = vi.fn();
    const view = renderPanel(changed);
    await actor.click(await screen.findByRole("button", { name: "Khóa salon" }));
    await confirmAction(actor);
    view.unmount();
    await act(async () => finish({ changed: true }));
    expect(changed).not.toHaveBeenCalled();
  });
  it("retries an initial read and ignores a pending old page after refresh", async () => {
    let finish!: (value: unknown) => void;
    mock.salonOperations
      .mockRejectedValueOnce(new Error("fixture offline"))
      .mockResolvedValueOnce({ ...snapshot, nextCursor: "request-a" })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    const actor = userEvent.setup();
    const view = renderPanel();
    await screen.findByRole("alert");
    await actor.click(screen.getByRole("button", { name: "Tải lại yêu cầu" }));
    await actor.click(await screen.findByRole("button", { name: "Tải thêm yêu cầu" }));
    view.unmount();
    await act(async () => finish(snapshot));
    expect(mock.manageSalon).not.toHaveBeenCalled();
  });
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
