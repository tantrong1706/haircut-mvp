import { render, screen } from "@testing-library/react";
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
  ScanEntryPage: () => <div>customer-entry</div>,
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
});
