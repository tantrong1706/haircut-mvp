import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AppSession } from "./services/types";

const mocks = vi.hoisted(() => ({
  stopSync: vi.fn(),
  stopAuth: vi.fn(),
  listenSessionLiveUpdates: vi.fn(),
  authListener: null as null | ((user: { uid: string } | null) => void),
}));
vi.mock("./services/customerWebAuth", () => ({
  subscribeCustomerWebAuth: (listener: (user: { uid: string } | null) => void) => {
    mocks.authListener = listener;
    return mocks.stopAuth;
  },
}));
vi.mock("./services/monitoring", () => ({ trackEvent: vi.fn() }));
vi.mock("./services/api", () => ({ listenSessionLiveUpdates: mocks.listenSessionLiveUpdates }));
vi.mock("./components/InstallAppPrompt", () => ({ InstallAppPrompt: () => null }));
vi.mock("./pages/WebCustomerEntryPage", () => ({
  WebCustomerEntryPage: ({ onReady }: { onReady: (session: AppSession) => void }) => (
    <button
      onClick={() =>
        onReady({
          identityProvider: "firebase",
          firebaseUid: "uid-web",
          zaloUserId: "",
          qr: { qrType: "branch", salonId: "salon-web", branchId: "branch-web", mirrorId: "" },
          sessionId: "session-web",
          sessionStatus: "pending_approval",
          customer: {
            customerId: "customer-web",
            name: "Khách Web",
            phoneLast4: "4567",
            points: 4,
            allowPhoto: true,
          },
        })
      }
    >
      Web check-in
    </button>
  ),
}));
vi.mock("./pages/HomePage", () => ({
  HomePage: ({
    session,
    onResetSession,
    onRetrySync,
  }: {
    session: AppSession;
    onResetSession: () => void;
    onRetrySync: () => void;
  }) => (
    <div>
      <h1>{session.customer.name}</h1>
      <span>{session.customer.points} điểm</span>
      <button onClick={onResetSession}>Quét lại QR</button>
      <button onClick={onRetrySync}>Đồng bộ lại</button>
    </div>
  ),
}));
vi.mock("./pages/CustomerAccountPage", () => ({
  CustomerAccountPage: ({ onLoggedOut }: { onLoggedOut: () => void }) => (
    <button onClick={onLoggedOut}>Web logout</button>
  ),
}));
vi.mock("./pages/AuthGate", () => ({ AuthGate: () => <div>management-auth</div> }));
vi.mock("./pages/AppCheckDiagnosticPage", () => ({
  AppCheckDiagnosticPage: () => <div>app-check-diagnostic</div>,
}));
vi.mock("./pages/HistoryPage", () => ({ HistoryPage: () => <h1>Lịch sử cắt tóc</h1> }));
vi.mock("./pages/RewardsPage", () => ({ RewardsPage: () => <h1>Quà của tôi</h1> }));
vi.mock("./pages/PrivacyPage", () => ({ PrivacyPage: () => <h1>Chính sách quyền riêng tư</h1> }));
vi.mock("./pages/TermsPage", () => ({ TermsPage: () => <h1>Điều khoản sử dụng</h1> }));

describe("Web-only routing and Firebase session isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authListener = null;
    mocks.listenSessionLiveUpdates.mockReturnValue(mocks.stopSync);
    window.history.replaceState({}, "", "/checkin");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens Web even in an in-app browser and ignores cached legacy identity", async () => {
    vi.stubGlobal("ZJSBridge", {});
    localStorage.setItem(
      "haircut_customer_session_v2",
      JSON.stringify({ customerId: "legacy-customer", name: "Legacy customer" }),
    );
    render(<App />);
    expect(await screen.findByRole("button", { name: "Web check-in" })).toBeVisible();
    expect(screen.queryByText("Legacy customer")).toBeNull();
    expect(mocks.listenSessionLiveUpdates).not.toHaveBeenCalled();
  });

  it.each(["/staff", "/owner", "/delete-account"])(
    "keeps %s behind management authentication in any browser",
    async (path) => {
      vi.stubGlobal("ZJSBridge", {});
      window.history.replaceState({}, "", path);
      render(<App />);
      expect(await screen.findByText("management-auth")).toBeVisible();
      expect(mocks.authListener).toBeNull();
    },
  );

  it.each([
    ["/privacy", "Chính sách quyền riêng tư"],
    ["/terms", "Điều khoản sử dụng"],
  ])("opens public %s independently", async (path, heading) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(mocks.authListener).toBeNull();
  });

  it("diagnostic does not start customer authentication or points polling", async () => {
    window.history.replaceState({}, "", "/app-check");
    render(<App />);
    expect(await screen.findByText("app-check-diagnostic")).toBeVisible();
    expect(mocks.authListener).toBeNull();
    expect(mocks.listenSessionLiveUpdates).not.toHaveBeenCalled();
  });

  it("shows four Web tabs and clears customer data on logout", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Web check-in" }));
    expect(await screen.findByRole("heading", { name: "Khách Web" })).toBeVisible();
    const nav = screen.getByRole("navigation", { name: "Điều hướng" });
    expect(within(nav).getAllByRole("button")).toHaveLength(4);
    await user.click(within(nav).getByRole("button", { name: "Lịch sử" }));
    expect(await screen.findByRole("heading", { name: "Lịch sử cắt tóc" })).toBeVisible();
    await user.click(within(nav).getByRole("button", { name: "Quà và quay" }));
    expect(await screen.findByRole("heading", { name: "Quà của tôi" })).toBeVisible();
    await user.click(within(nav).getByRole("button", { name: "Tài khoản" }));
    await user.click(await screen.findByRole("button", { name: "Web logout" }));
    expect(await screen.findByRole("button", { name: "Web check-in" })).toBeVisible();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(mocks.stopSync).toHaveBeenCalled();
  });

  it.each([null, { uid: "another-uid" }])(
    "clears visible customer data when Firebase user changes to %j",
    async (user) => {
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: "Web check-in" }));
      await screen.findByRole("heading", { name: "Khách Web" });
      await waitFor(() => expect(mocks.authListener).not.toBeNull());
      act(() => mocks.authListener?.(user));
      expect(await screen.findByRole("button", { name: "Web check-in" })).toBeVisible();
      expect(screen.queryByText("4 điểm")).toBeNull();
    },
  );

  it("keeps the same Firebase user and disposes listeners when unmounted", async () => {
    const { unmount } = render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Web check-in" }));
    await screen.findByRole("heading", { name: "Khách Web" });
    await waitFor(() => expect(mocks.authListener).not.toBeNull());
    act(() => mocks.authListener?.({ uid: "uid-web" }));
    expect(screen.getByText("4 điểm")).toBeVisible();
    unmount();
    expect(mocks.stopSync).toHaveBeenCalled();
    expect(mocks.stopAuth).toHaveBeenCalled();
  });
});
