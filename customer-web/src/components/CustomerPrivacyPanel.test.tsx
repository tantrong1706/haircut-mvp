import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerPrivacyPanel } from "./CustomerPrivacyPanel";
import type { AppSession } from "../services/types";

const mocks = vi.hoisted(() => ({ withdraw: vi.fn() }));
vi.mock("../services/customerPrivacy", () => ({ withdrawCustomerPhotoPermission: mocks.withdraw }));
const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-a",
  sessionId: "session-a",
  zaloUserId: "",
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
  customer: {
    customerId: "customer-a",
    name: "Khách",
    points: 7,
    phoneLast4: "4567",
    allowPhoto: true,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.withdraw.mockResolvedValue({ allowPhoto: false });
});

describe("customer photo withdrawal", () => {
  it("reflects a permission revoked from another session", () => {
    const view = render(<CustomerPrivacyPanel session={session} />);
    expect(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" })).toBeEnabled();
    view.rerender(
      <CustomerPrivacyPanel
        session={{ ...session, customer: { ...session.customer, allowPhoto: false } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" })).toBeDisabled();
  });
  it("only withdraws after an explicit action and sends salon scope, not a customer identifier", async () => {
    const onPhotoRevoked = vi.fn();
    render(<CustomerPrivacyPanel session={session} onPhotoRevoked={onPhotoRevoked} />);
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" }));
    expect(mocks.withdraw).toHaveBeenCalledWith("salon-a");
    expect(await screen.findByText("Đã ngừng cho phép lưu ảnh.")).toBeVisible();
    expect(onPhotoRevoked).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Yêu cầu xem, sửa hoặc xóa dữ liệu" })).toHaveAttribute(
      "href",
      "/data-rights",
    );
  });
  it("retains the current state on errors and makes retry explicit", async () => {
    mocks.withdraw.mockRejectedValueOnce(new Error("Mạng chưa sẵn sàng"));
    const onPhotoRevoked = vi.fn();
    render(<CustomerPrivacyPanel session={session} onPhotoRevoked={onPhotoRevoked} />);
    await userEvent.click(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mạng chưa sẵn sàng");
    expect(onPhotoRevoked).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" })).toBeEnabled();
  });
  it("does not resubmit while pending or update an unmounted account", async () => {
    let finish!: (value: { allowPhoto: false }) => void;
    mocks.withdraw.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onPhotoRevoked = vi.fn();
    const view = render(<CustomerPrivacyPanel session={session} onPhotoRevoked={onPhotoRevoked} />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Ngừng cho phép lưu ảnh" }));
    expect(mocks.withdraw).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => {
      finish({ allowPhoto: false });
    });
    expect(onPhotoRevoked).not.toHaveBeenCalled();
  });
});
