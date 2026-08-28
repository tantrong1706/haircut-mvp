import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaffManager } from "./StaffManager";

const { createStaffProfile, getBranchQrSettings, listenStaffProfiles } = vi.hoisted(() => ({
  createStaffProfile: vi.fn(),
  getBranchQrSettings: vi.fn(),
  listenStaffProfiles: vi.fn(),
}));

vi.mock("../../../services/managerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/managerApi")>();
  return {
    ...actual,
    createStaffProfile,
    getBranchQrSettings,
    listenStaffProfiles,
  };
});

describe("Manager cấp quyền cộng điểm trực tiếp", () => {
  beforeEach(() => {
    createStaffProfile.mockReset();
    createStaffProfile.mockResolvedValue({
      uid: "staff-new",
      email: "staff@example.com",
      inviteEmailSent: true,
    });
    getBranchQrSettings.mockReset();
    getBranchQrSettings.mockResolvedValue({
      branches: [
        {
          id: "branch-1",
          salonId: "salon-1",
          name: "Chi nhánh chính",
          address: "",
          isActive: true,
        },
      ],
    });
    listenStaffProfiles.mockReset();
    listenStaffProfiles.mockImplementation(
      (_salonId: string, onChange: (staff: unknown[]) => void) => {
        onChange([]);
        return () => undefined;
      },
    );
  });

  it("truyền rõ quyền cộng điểm trực tiếp khi tạo nhân viên tin cậy", async () => {
    const user = userEvent.setup();
    render(<StaffManager salonId="salon-1" />);

    await waitFor(() => expect(getBranchQrSettings).toHaveBeenCalledWith("salon-1"));
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    await user.type(screen.getByLabelText("Email nhân viên"), "staff@example.com");
    await user.type(screen.getByLabelText("Tên nhân viên"), "Minh");
    await user.click(screen.getByLabelText("Cho hoàn tất và cộng điểm trực tiếp"));
    await user.click(screen.getByRole("button", { name: "Tạo và gửi email mời" }));

    await waitFor(() =>
      expect(createStaffProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          salonId: "salon-1",
          canAwardPointsDirectly: true,
          branchIds: ["branch-1"],
        }),
      ),
    );
  });
});
