import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser, StaffSession } from "../../services/managerApi";
import { StaffSessionDetail } from "./StaffSessionDetail";

const service = vi.hoisted(() => ({
  claimServiceSession: vi.fn(),
  submitPointRequest: vi.fn(),
}));

vi.mock("../../services/managerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/managerApi")>();
  return {
    ...actual,
    claimServiceSession: service.claimServiceSession,
    submitPointRequest: service.submitPointRequest,
  };
});

vi.mock("../../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: async (
    _name: string,
    action: () => Promise<unknown>,
  ) => action(),
}));

const user: AppUser = {
  uid: "staff-1",
  salonId: "salon-1",
  name: "Minh",
  avatarUrl: "",
  role: "staff",
  isActive: true,
  branchId: "branch-1",
  branchIds: ["branch-1"],
};

function session(status: StaffSession["status"]): StaffSession {
  return {
    id: "session-1",
    salonId: "salon-1",
    branchId: "branch-1",
    branchName: "Chi nhánh chính",
    branchAddress: "123 Nguyễn Huệ",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-1",
    status,
    assignedStaffId: status === "serving" ? "staff-1" : "",
    assignedStaffName: status === "serving" ? "Minh" : "",
    claimedAtMs: status === "serving" ? Date.now() : null,
    createdAtMs: Date.now(),
    expiresAtMs: null,
    cancellationReason: "",
    customer: {
      id: "customer-1",
      name: "Anh Nam",
      phoneLast4: "8761",
      points: 4,
      allowPhoto: false,
    },
  };
}

function renderDetail(input: {
  currentSession: StaffSession;
  note?: string;
  pointApprovalEnabled?: boolean;
  photoUploadEnabled?: boolean;
}) {
  const onSessionChange = vi.fn();
  render(
    <StaffSessionDetail
      user={user}
      session={input.currentSession}
      pointPerVisit={1}
      photos={[]}
      note={input.note || ""}
      onBack={vi.fn()}
      onSessionChange={onSessionChange}
      onSessionRemove={vi.fn()}
      onPhotosChange={vi.fn()}
      onNoteChange={vi.fn()}
      pointApprovalEnabled={input.pointApprovalEnabled ?? true}
      photoUploadEnabled={input.photoUploadEnabled ?? true}
    />,
  );
  return { onSessionChange };
}

describe("luồng phục vụ của Staff", () => {
  beforeEach(() => {
    service.claimServiceSession.mockReset();
    service.submitPointRequest.mockReset();
  });

  it("nhận đúng lượt và gửi payload tenant/branch hiện tại", async () => {
    service.claimServiceSession.mockResolvedValue({
      status: "serving",
      assignedStaffId: "staff-1",
      assignedStaffName: "Minh",
    });
    const waiting = session("waiting");
    const { onSessionChange } = renderDetail({ currentSession: waiting });

    await userEvent.click(screen.getByRole("button", { name: "Nhận khách" }));
    expect(service.claimServiceSession).toHaveBeenCalledWith({
      salonId: "salon-1",
      session: waiting,
    });
    expect(onSessionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        status: "serving",
        assignedStaffId: "staff-1",
      }),
    );
  });

  it("gửi yêu cầu điểm đúng một lần khi người dùng bấm nhanh", async () => {
    let resolve!: () => void;
    service.submitPointRequest.mockImplementation(
      () => new Promise<void>((done) => (resolve = done)),
    );
    const serving = session("serving");
    const { onSessionChange } = renderDetail({
      currentSession: serving,
      note: "Fade thấp",
    });
    const submit = screen.getByRole("button", { name: "Gửi cộng 1 điểm" });

    await userEvent.click(submit);
    await userEvent.click(submit);
    expect(service.submitPointRequest).toHaveBeenCalledOnce();
    expect(service.submitPointRequest).toHaveBeenCalledWith({
      salonId: "salon-1",
      session: serving,
      note: "Fade thấp",
      photoUrls: [],
      pointsRequested: 1,
    });

    await act(async () => resolve());
    expect(onSessionChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_approval" }),
    );
  });

  it("khóa gửi điểm và tải ảnh khi feature flag tắt", () => {
    renderDetail({
      currentSession: session("serving"),
      note: "Fade thấp",
      pointApprovalEnabled: false,
      photoUploadEnabled: false,
    });
    expect(screen.getByRole("button", { name: "Gửi cộng 1 điểm" })).toBeDisabled();
    expect(screen.getByText(/gửi và duyệt điểm đang tạm ngừng/i)).toBeInTheDocument();
    expect(screen.getByText(/tải ảnh đang tạm ngừng/i)).toBeInTheDocument();
  });
});
