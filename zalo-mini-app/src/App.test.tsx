import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  isZaloMiniAppRuntime: vi.fn(),
}));

vi.mock("./services/runtime", () => ({
  isZaloMiniAppRuntime: mocks.isZaloMiniAppRuntime,
}));

vi.mock("./services/monitoring", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("./services/sessionStore", () => ({
  clearSavedSession: vi.fn(),
  loadSavedSession: vi.fn(() => null),
  saveSession: vi.fn(),
}));

vi.mock("./components/InstallAppPrompt", () => ({
  InstallAppPrompt: () => null,
}));

vi.mock("./pages/ScanEntryPage", () => ({
  ScanEntryPage: ({
    onOpenLegalPage,
  }: {
    onOpenLegalPage?: (page: "privacy" | "terms") => void;
  }) => (
    <div>
      <span>customer-entry</span>
      <button type="button" onClick={() => onOpenLegalPage?.("privacy")}>
        Chính sách quyền riêng tư
      </button>
      <button type="button" onClick={() => onOpenLegalPage?.("terms")}>
        Điều khoản sử dụng
      </button>
    </div>
  ),
}));

vi.mock("./pages/AuthGate", () => ({
  AuthGate: () => <div>management-auth</div>,
}));

describe("App trong Zalo Mini App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/owner");
  });

  it("không mở route quản lý trong runtime khách hàng Zalo", async () => {
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);

    render(<App />);

    expect(await screen.findByText("customer-entry")).toBeInTheDocument();
    expect(screen.queryByText("management-auth")).not.toBeInTheDocument();
  });

  it("giữ route quản lý trên trình duyệt web thông thường", async () => {
    mocks.isZaloMiniAppRuntime.mockReturnValue(false);

    render(<App />);

    expect(await screen.findByText("management-auth")).toBeInTheDocument();
    expect(screen.queryByText("customer-entry")).not.toBeInTheDocument();
  });

  it("mở Chính sách quyền riêng tư bên trong Mini App và quay lại màn yêu cầu QR", async () => {
    const user = userEvent.setup();
    const initialDocument = window.document;
    window.history.replaceState({}, "", "/");
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Chính sách quyền riêng tư" }));

    expect(await screen.findByRole("heading", { name: "Chính sách quyền riêng tư" })).toBeVisible();
    expect(screen.getByText("1. Đơn vị quản lý dữ liệu")).toBeVisible();
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#privacy");
    expect(window.document).toBe(initialDocument);
    expect(screen.queryByText("management-auth")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.getByText("customer-entry")).toBeVisible());
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
  });

  it("mở Điều khoản sử dụng bên trong Mini App mà không reload document", async () => {
    const user = userEvent.setup();
    const initialDocument = window.document;
    window.history.replaceState({}, "", "/");
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Điều khoản sử dụng" }));

    expect(await screen.findByRole("heading", { name: "Điều khoản sử dụng" })).toBeVisible();
    expect(screen.getByText("1. Phạm vi dịch vụ")).toBeVisible();
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#terms");
    expect(window.document).toBe(initialDocument);

    await user.click(screen.getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.getByText("customer-entry")).toBeVisible());
  });

  it("mở trực tiếp hash pháp lý khi chưa quét QR hoặc đăng nhập", async () => {
    window.history.replaceState({}, "", "/#privacy");
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Chính sách quyền riêng tư" })).toBeVisible();
    expect(screen.queryByText("customer-entry")).not.toBeInTheDocument();
    expect(screen.queryByText("management-auth")).not.toBeInTheDocument();
  });
});
