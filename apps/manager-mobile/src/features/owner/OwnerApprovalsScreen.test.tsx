import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmDialogRequest } from "../../components/ConfirmDialog";
import type { PointRequest } from "../../services/managerApi";
import { OwnerApprovalsScreen } from "./OwnerApprovalsScreen";

const { approvePointRequest, rejectPointRequest } = vi.hoisted(() => ({
  approvePointRequest: vi.fn(),
  rejectPointRequest: vi.fn(),
}));

vi.mock("../../services/managerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/managerApi")>();
  return { ...actual, approvePointRequest, rejectPointRequest };
});

vi.mock("../../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: async (
    _name: string,
    action: () => Promise<unknown>,
  ) => action(),
}));

const pointRequest: PointRequest = {
  id: "request-1",
  salonId: "salon-1",
  branchId: "branch-1",
  branchName: "Chi nhánh chính",
  customerId: "customer-1",
  sessionId: "session-1",
  staffName: "Minh",
  pointsAdded: 1,
  note: "Fade thấp",
  photoUrls: [],
  status: "pending",
  createdAtMs: Date.now(),
  customer: {
    id: "customer-1",
    name: "Anh Nam",
    phoneLast4: "8761",
    points: 5,
    allowPhoto: false,
  },
};

describe("Owner từ chối yêu cầu điểm", () => {
  beforeEach(() => {
    approvePointRequest.mockReset();
    approvePointRequest.mockResolvedValue({ ok: true });
    rejectPointRequest.mockReset();
    rejectPointRequest.mockResolvedValue({ ok: true });
  });

  it("duyệt đúng yêu cầu và cập nhật danh sách sau khi service thành công", async () => {
    const user = userEvent.setup();
    let confirmation: ConfirmDialogRequest | null = null;
    const onRequestsChange = vi.fn();
    const onRefreshOverview = vi.fn();
    render(
      <OwnerApprovalsScreen
        salonId="salon-1"
        requests={[pointRequest]}
        branches={[]}
        branchFilter="all"
        onBranchFilterChange={vi.fn()}
        onRequestsChange={onRequestsChange}
        onRefreshOverview={onRefreshOverview}
        onConfirm={(request) => {
          confirmation = request;
        }}
        pointApprovalEnabled
        photoUploadEnabled
      />,
    );

    await user.click(screen.getByRole("button", { name: "Duyệt điểm" }));
    expect(confirmation).not.toBeNull();
    await act(async () => {
      await confirmation?.onConfirm();
    });

    expect(approvePointRequest).toHaveBeenCalledOnce();
    expect(approvePointRequest).toHaveBeenCalledWith(pointRequest);
    expect(onRequestsChange).toHaveBeenCalledWith([]);
    expect(onRefreshOverview).toHaveBeenCalledOnce();
    expect(screen.getByText(/đã duyệt điểm và lưu lịch sử/i)).toBeInTheDocument();
  });

  it("bắt buộc lý do và gửi đúng lý do thật tới service", async () => {
    const user = userEvent.setup();
    let confirmation: ConfirmDialogRequest | null = null;
    const onRequestsChange = vi.fn();
    render(
      <OwnerApprovalsScreen
        salonId="salon-1"
        requests={[pointRequest]}
        branches={[]}
        branchFilter="all"
        onBranchFilterChange={vi.fn()}
        onRequestsChange={onRequestsChange}
        onRefreshOverview={vi.fn()}
        onConfirm={(request) => {
          confirmation = request;
        }}
        pointApprovalEnabled
        photoUploadEnabled
      />,
    );

    await user.click(screen.getByRole("button", { name: "Từ chối" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận lý do" }));
    expect(screen.getByRole("alert")).toHaveTextContent("ít nhất 5 ký tự");
    expect(rejectPointRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yêu cầu bị gửi nhầm" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận lý do" }));
    expect(confirmation).not.toBeNull();
    await act(async () => {
      await confirmation?.onConfirm();
    });

    expect(rejectPointRequest).toHaveBeenCalledWith(
      pointRequest,
      "Yêu cầu bị gửi nhầm",
    );
    expect(onRequestsChange).toHaveBeenCalledWith([]);
  });

  it("khóa hành động khi feature duyệt điểm bị tắt", () => {
    render(
      <OwnerApprovalsScreen
        salonId="salon-1"
        requests={[pointRequest]}
        branches={[]}
        branchFilter="all"
        onBranchFilterChange={vi.fn()}
        onRequestsChange={vi.fn()}
        onRefreshOverview={vi.fn()}
        onConfirm={vi.fn()}
        pointApprovalEnabled={false}
        photoUploadEnabled={false}
      />,
    );
    expect(screen.getByText(/duyệt điểm đang tạm ngừng/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duyệt điểm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeDisabled();
  });
});
