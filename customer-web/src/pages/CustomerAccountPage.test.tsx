import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";

const mocks = vi.hoisted(() => ({ signOutCustomerWeb: vi.fn() }));
vi.mock("../services/customerWebAuth", () => ({ signOutCustomerWeb: mocks.signOutCustomerWeb }));

import { CustomerAccountPage } from "./CustomerAccountPage";

const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-a",
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
  sessionId: "session-a",
  branchName: "Chi nhánh A",
  zaloUserId: "",
  customer: {
    customerId: "customer-a",
    name: "Khách hàng",
    phoneLast4: "4567",
    points: 5,
    allowPhoto: false,
  },
};

describe("CustomerAccountPage", () => {
  it("chỉ logout customer Auth và không xóa dữ liệu server", async () => {
    const user = userEvent.setup();
    const onLoggedOut = vi.fn();
    mocks.signOutCustomerWeb.mockResolvedValue(undefined);
    render(<CustomerAccountPage session={session} onLoggedOut={onLoggedOut} />);

    expect(screen.getByText(/4567/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Đăng xuất khỏi thiết bị này" }));
    expect(mocks.signOutCustomerWeb).toHaveBeenCalledTimes(1);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/xóa dữ liệu/i)).not.toBeInTheDocument();
  });
});
