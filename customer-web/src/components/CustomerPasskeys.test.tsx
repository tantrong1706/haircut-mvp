import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ available: vi.fn(), register: vi.fn(), signIn: vi.fn(), list: vi.fn(), remove: vi.fn() }));
vi.mock("../services/customerPasskeys", () => ({
  customerPasskeysAvailable: mocks.available, registerCustomerPasskey: mocks.register,
  signInCustomerPasskey: mocks.signIn, listCustomerPasskeys: mocks.list,
  removeCustomerPasskey: mocks.remove, customerPasskeyError: () => "Bạn vẫn có thể dùng OTP.",
}));
import { CustomerPasskeyPanel, CustomerPasskeySignIn } from "./CustomerPasskeys";
describe("optional passkey controls", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.available.mockReturnValue(true); mocks.list.mockResolvedValue({ keys: [] }); mocks.register.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); });
  it("keeps OTP as the fallback when the browser or rollout does not support passkeys", () => {
    mocks.available.mockReturnValue(false);
    const { container } = render(<><CustomerPasskeySignIn /><CustomerPasskeyPanel /></>);
    expect(container).toBeEmptyDOMElement(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("enrolls only after the user explicitly asks and shows success", async () => {
    const user = userEvent.setup(); render(<CustomerPasskeyPanel />);
    await user.click(await screen.findByRole("button", { name: "Thêm passkey" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã thêm passkey");
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });
  it("lets the customer remove their registered key", async () => {
    mocks.list.mockResolvedValueOnce({ keys: [{ id: "key-a", createdAtMs: 0 }] });
    const user = userEvent.setup(); render(<CustomerPasskeyPanel />);
    await user.click(await screen.findByRole("button", { name: "Gỡ passkey 1" }));
    expect(mocks.remove).toHaveBeenCalledWith("key-a");
  });
  it("cancelled sign-in displays an OTP fallback without automatically sending anything", async () => {
    mocks.signIn.mockRejectedValue(new DOMException("Cancel", "NotAllowedError"));
    const user = userEvent.setup(); render(<CustomerPasskeySignIn />);
    await user.click(screen.getByRole("button", { name: "Đăng nhập bằng passkey" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bạn vẫn có thể dùng OTP");
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });
});
