import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
const mocks = vi.hoisted(() => ({
  ownName: vi.fn(),
  managerName: vi.fn(),
  logout: vi.fn(),
  captureError: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock("../services/customerName", () => ({
  updateOwnCustomerName: mocks.ownName,
  updateCustomerName: mocks.managerName,
}));
vi.mock("../services/customerWebAuth", () => ({ signOutCustomerWeb: mocks.logout }));
vi.mock("../services/monitoring", () => ({
  captureError: mocks.captureError,
  trackEvent: mocks.trackEvent,
}));
import { CustomerAccountPage } from "./CustomerAccountPage";
const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-a",
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
  sessionId: "session-a",
  branchName: "Branch",
  zaloUserId: "",
  customer: {
    customerId: "customer-a",
    name: "Khách 4567",
    phoneLast4: "4567",
    points: 7,
    allowPhoto: false,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ownName.mockResolvedValue({ customerId: "customer-a", name: "Anh Minh" });
});

it("keeps a logout failure visible without clearing the customer's session", async () => {
  const user = userEvent.setup();
  const loggedOut = vi.fn();
  mocks.logout.mockRejectedValueOnce(new Error("Network unavailable"));
  render(<CustomerAccountPage session={session} onLoggedOut={loggedOut} />);
  await user.click(screen.getByRole("button", { name: "Đăng xuất khỏi thiết bị này" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Chưa đăng xuất được");
  expect(loggedOut).not.toHaveBeenCalled();
});

it("supports empty display fields and saving without an optional parent callback", async () => {
  const user = userEvent.setup();
  render(
    <CustomerAccountPage
      session={{ ...session, customer: { ...session.customer, name: "", phoneLast4: "" } }}
      onLoggedOut={vi.fn()}
    />,
  );
  expect(screen.getByRole("heading", { name: "Khách hàng", exact: true })).toBeVisible();
  expect(screen.getByText(/----/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Sửa tên khách/ }));
  await user.type(screen.getByRole("textbox", { name: "Tên khách" }), "Anh Minh");
  await user.click(screen.getByRole("button", { name: "Lưu tên" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên");
});
it("lets the authenticated customer explicitly save their own name without logout or point changes", async () => {
  const user = userEvent.setup();
  const saved = vi.fn();
  render(<CustomerAccountPage session={session} onLoggedOut={vi.fn()} onNameSaved={saved} />);
  expect(mocks.ownName).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /Sửa tên khách/ }));
  const field = screen.getByRole("textbox", { name: "Tên khách" });
  await user.clear(field);
  await user.type(field, "Anh Minh");
  await user.click(screen.getByRole("button", { name: "Lưu tên" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên");
  expect(mocks.ownName).toHaveBeenCalledWith({
    salonId: "salon-a",
    customerId: "customer-a",
    name: "Anh Minh",
    expectedName: "Khách 4567",
  });
  expect(saved).toHaveBeenCalledWith("Anh Minh");
  expect(mocks.managerName).not.toHaveBeenCalled();
  expect(mocks.logout).not.toHaveBeenCalled();
  expect(session.customer).toMatchObject({ name: "Khách 4567", points: 7, phoneLast4: "4567" });
});
it("cancel writes nothing, and a failed self-service save keeps the draft for retry", async () => {
  const user = userEvent.setup();
  const saved = vi.fn();
  render(<CustomerAccountPage session={session} onLoggedOut={vi.fn()} onNameSaved={saved} />);
  await user.click(screen.getByRole("button", { name: /Sửa tên khách/ }));
  await user.click(screen.getByRole("button", { name: "Hủy đổi tên" }));
  expect(mocks.ownName).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /Sửa tên khách/ }));
  const field = screen.getByRole("textbox", { name: "Tên khách" });
  await user.clear(field);
  await user.type(field, "Anh Minh");
  mocks.ownName.mockRejectedValueOnce(new Error("Vui lòng tải lại tên"));
  await user.click(screen.getByRole("button", { name: "Lưu tên" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng tải lại tên");
  expect(field).toHaveValue("Anh Minh");
  expect(saved).not.toHaveBeenCalled();
});
