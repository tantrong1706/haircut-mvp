import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), confirm: vi.fn() }));
vi.mock("../services/ownerWorkspace", () => ({ savePendingVisitNote: mocks.save }));
vi.mock("../services/operations", () => ({
  getBranchQrSettings: async () => ({ branches: [{ id: "branch-fixture", name: "Demo" }] }),
  getSalonProfile: async () => ({ pointPerVisit: 1, name: "Demo" }),
  listenActiveSessions: (_salon: string, _branches: string[], next: (value: unknown[]) => void) => {
    next(["A", "B"].map(letter => ({ id: `request-${letter}`, salonId: "salon-fixture", branchId: "branch-fixture", branchName: "Demo", status: "pending_approval", approvalMode: "staff_confirmation", note: `Saved ${letter}`, expiresAtMs: Date.now() + 600_000, customerId: `customer-${letter}`, customer: { name: `Khách ${letter}`, phoneLast4: "5678", points: 2, allowPhoto: false } })));
    return () => undefined;
  },
  formatDateTime: () => "09:30", confirmCustomerPointRequest: mocks.confirm,
  cancelServiceSession: vi.fn(), claimServiceSession: vi.fn(), rejectCustomerPointRequest: vi.fn(), submitPointRequest: vi.fn(), searchSalonCustomers: vi.fn(),
}));
vi.mock("../services/customerPhotos", () => ({ MAX_HAIRCUT_PHOTOS: 3, deleteHaircutPhoto: vi.fn(), recoverHaircutPhotoUploads: vi.fn(), uploadHaircutPhoto: vi.fn() }));
vi.mock("../services/monitoring", () => ({ trackEvent: vi.fn(), withMonitoringTrace: vi.fn() }));
import { StaffPage } from "./StaffPage";
const currentUser = { uid: "staff-fixture", salonId: "salon-fixture", name: "Staff", avatarUrl: "", role: "staff" as const, isActive: true, branchIds: ["branch-fixture"] };
describe("staff pending visit notes", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.save.mockResolvedValue(undefined); });
  it("loads saved notes, keeps drafts isolated by customer, and saves without awarding points", async () => {
    const user = userEvent.setup();
    render(<StaffPage currentUser={currentUser} />);
    const note = await screen.findByPlaceholderText("Ví dụ: Fade thấp, giữ mái, không cắt quá cao");
    expect(note).toHaveValue("Saved A");
    await user.clear(note); await user.type(note, "Draft A");
    await user.click(screen.getByRole("button", { name: /Khách B Chờ xác nhận/ }));
    expect(note).toHaveValue("Saved B");
    await user.click(screen.getByRole("button", { name: /Khách A Chờ xác nhận/ }));
    expect(note).toHaveValue("Draft A");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú", exact: true }));
    expect(await screen.findByText("Đã lưu ghi chú.")).toBeVisible();
    expect(mocks.save).toHaveBeenCalledWith({ salonId: "salon-fixture", requestId: "request-A", note: "Draft A" });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("retains the draft and reports a failed save without awarding points", async () => {
    mocks.save.mockRejectedValue(new Error("Fixture save denied"));
    const user = userEvent.setup();
    render(<StaffPage currentUser={currentUser} />);
    const note = await screen.findByPlaceholderText("Ví dụ: Fade thấp, giữ mái, không cắt quá cao");
    await user.clear(note); await user.type(note, "Draft after failure");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú", exact: true }));
    expect(await screen.findByText("Fixture save denied")).toBeVisible();
    expect(note).toHaveValue("Draft after failure");
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
