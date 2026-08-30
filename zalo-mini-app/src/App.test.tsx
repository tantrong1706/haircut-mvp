import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  isZaloMiniAppRuntime: vi.fn(),
  loadSavedSessionCandidate: vi.fn(),
  clearSavedSession: vi.fn(),
  saveSession: vi.fn(),
  restoreSavedCustomerSession: vi.fn(),
  listenSessionLiveUpdates: vi.fn(() => () => undefined),
}));

vi.mock("./services/runtime", () => ({
  isZaloMiniAppRuntime: mocks.isZaloMiniAppRuntime,
}));

vi.mock("./services/monitoring", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("./services/sessionStore", () => ({
  clearSavedSession: mocks.clearSavedSession,
  loadSavedSessionCandidate: mocks.loadSavedSessionCandidate,
  saveSession: mocks.saveSession,
}));

vi.mock("./services/api", () => ({
  listenSessionLiveUpdates: mocks.listenSessionLiveUpdates,
  restoreSavedCustomerSession: mocks.restoreSavedCustomerSession,
}));

vi.mock("./components/InstallAppPrompt", () => ({
  InstallAppPrompt: () => null,
}));

vi.mock("./pages/ScanEntryPage", () => ({
  ScanEntryPage: ({
    onReady,
    onOpenLegalPage,
  }: {
    onReady?: (session: unknown) => void;
    onOpenLegalPage?: (page: "privacy" | "terms") => void;
  }) => (
    <div>
      <span>customer-entry</span>
      <button
        type="button"
        onClick={() =>
          onReady?.({
            qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
            sessionId: "session-b",
            zaloUserId: "zalo-b",
            sessionStatus: "waiting",
            customer: {
              customerId: "customer-b",
              name: "Khach B",
              points: 8,
              allowPhoto: false,
            },
          })
        }
      >
        Tao luot cho B
      </button>
      <button type="button" onClick={() => onOpenLegalPage?.("privacy")}>
        Chính sách quyền riêng tư
      </button>
      <button type="button" onClick={() => onOpenLegalPage?.("terms")}>
        Điều khoản sử dụng
      </button>
    </div>
  ),
}));

vi.mock("./pages/HomePage", () => ({
  HomePage: ({ session }: { session: { customer: { name: string; points: number } } }) => (
    <div>{`home:${session.customer.name}:points:${session.customer.points}`}</div>
  ),
}));

vi.mock("./pages/AuthGate", () => ({
  AuthGate: () => <div>management-auth</div>,
}));

describe("App trong Zalo Mini App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSavedSessionCandidate.mockReturnValue(null);
    mocks.restoreSavedCustomerSession.mockReset();
    mocks.listenSessionLiveUpdates.mockReturnValue(() => undefined);
    window.history.replaceState({}, "", "/owner");
  });

  it("khong render du lieu cache cu truoc khi backend xac minh danh tinh", async () => {
    let resolveRestore!: (value: unknown) => void;
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
    mocks.loadSavedSessionCandidate.mockReturnValue({
      schemaVersion: 2,
      salonId: "salon-a",
      sessionId: "session-a",
      customerId: "customer-a",
      identityBinding: "a".repeat(64),
      savedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
    });
    mocks.restoreSavedCustomerSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRestore = resolve;
      }),
    );
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByText("Đang xác minh phiên khách...")).toBeVisible();
    expect(screen.queryByText(/Khach A|points:3/)).not.toBeInTheDocument();

    resolveRestore({
      status: "restored",
      session: {
        qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
        sessionId: "session-a",
        zaloUserId: "",
        identityBinding: "a".repeat(64),
        sessionStatus: "waiting",
        customer: { customerId: "customer-a", name: "Khach A", points: 3, allowPhoto: false },
      },
    });

    expect(await screen.findByText("home:Khach A:points:3")).toBeVisible();
  });

  it("xoa cache A khi Zalo hien tai la B va khong de lo du lieu A", async () => {
    const user = userEvent.setup();
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
    mocks.loadSavedSessionCandidate.mockReturnValue({
      schemaVersion: 2,
      salonId: "salon-a",
      sessionId: "session-a",
      customerId: "customer-a",
      identityBinding: "a".repeat(64),
      savedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
    });
    mocks.restoreSavedCustomerSession.mockResolvedValue({
      status: "discarded",
      reason: "identity_mismatch",
    });
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByText("customer-entry")).toBeVisible();
    expect(mocks.clearSavedSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Khach A|points:3/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tao luot cho B" }));
    expect(await screen.findByText("home:Khach B:points:8")).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "Điều hướng" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(3);
    expect(within(navigation).getByRole("button", { name: "Quà và quay" })).toBeVisible();
    expect(within(navigation).queryByRole("button", { name: "Vòng quay" })).toBeNull();
  });

  it("giu candidate nhung khong hien du lieu cu khi backend timeout", async () => {
    mocks.isZaloMiniAppRuntime.mockReturnValue(true);
    mocks.loadSavedSessionCandidate.mockReturnValue({
      schemaVersion: 2,
      salonId: "salon-a",
      sessionId: "session-a",
      customerId: "customer-a",
      identityBinding: "a".repeat(64),
      savedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", mirrorId: "" },
    });
    mocks.restoreSavedCustomerSession.mockRejectedValue(new Error("Ket noi dang cham"));
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(await screen.findByText("Chưa xác minh được phiên khách")).toBeVisible();
    expect(screen.queryByText(/Khach A|points:3/)).not.toBeInTheDocument();
    expect(mocks.clearSavedSession).not.toHaveBeenCalled();
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
