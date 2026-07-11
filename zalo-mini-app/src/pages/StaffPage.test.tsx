import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffSession } from "../services/operations";
import { StaffPage } from "./StaffPage";

const mocks = vi.hoisted(() => ({
  claimServiceSession: vi.fn(),
  submitPointRequest: vi.fn(),
  listenActiveSessions: vi.fn(),
  getSalonProfile: vi.fn(),
}));

vi.mock("../services/operations", () => ({
  claimServiceSession: mocks.claimServiceSession,
  submitPointRequest: mocks.submitPointRequest,
  listenActiveSessions: mocks.listenActiveSessions,
  getSalonProfile: mocks.getSalonProfile,
  formatDateTime: () => "09:00 12/07/2026",
}));

vi.mock("../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: (_name: string, action: () => Promise<unknown>) => action(),
}));

const waitingSession: StaffSession = {
  id: "session-a",
  salonId: "salon-a",
  mirrorId: "mirror-1",
  mirrorName: "Gương 1",
  customerId: "customer-a",
  zaloUserId: "zalo-a",
  status: "waiting",
  assignedStaffId: "",
  assignedStaffName: "",
  claimedAtMs: null,
  createdAtMs: Date.now(),
  customer: {
    id: "customer-a",
    name: "Anh Tân",
    phoneLast4: "6789",
    points: 4,
    allowPhoto: false,
  },
};

describe("StaffPage", () => {
  beforeEach(() => {
    mocks.getSalonProfile.mockResolvedValue({
      id: "salon-a",
      name: "HAIRCUT Studio",
      address: "",
      phone: "",
      pointPerVisit: 2,
      freeCustomerLimit: 50,
    });
    mocks.listenActiveSessions.mockImplementation(
      (_salonId: string, onChange: (sessions: StaffSession[]) => void) => {
        onChange([waitingSession]);
        return vi.fn();
      },
    );
    mocks.claimServiceSession.mockResolvedValue({
      status: "serving",
      assignedStaffId: "staff-a",
      assignedStaffName: "Nam",
    });
    mocks.submitPointRequest.mockResolvedValue({ requestId: "session-a" });
  });

  it("bắt buộc nhận khách trước khi ghi chú và gửi điểm", async () => {
    const user = userEvent.setup();
    render(
      <StaffPage
        currentUser={{
          uid: "staff-a",
          salonId: "salon-a",
          name: "Nam",
          avatarUrl: "",
          role: "staff",
          isActive: true,
          canRedeemRewards: false,
        }}
      />,
    );

    const note = await screen.findByPlaceholderText(/Fade thấp/i);
    expect(note).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Nhận khách/i }));
    await waitFor(() => expect(mocks.claimServiceSession).toHaveBeenCalledOnce());
    expect(note).toBeEnabled();

    await user.type(note, "Giữ form cũ");
    await user.click(screen.getByRole("button", { name: /Gửi cộng 2 điểm/i }));

    await waitFor(() => expect(mocks.submitPointRequest).toHaveBeenCalledOnce());
    expect(screen.getByText("Đang chờ chủ duyệt")).toBeInTheDocument();
  });
});
