import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { App } from "./App";

const mock = vi.hoisted(() => ({ access: vi.fn(), subscribe: vi.fn(), getDoc: vi.fn() }));
vi.mock("./services/firebase", () => ({ auth: {}, db: {} }));
vi.mock("./services/adminApi", () => ({ adminApi: { access: mock.access } }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: mock.subscribe, signOut: vi.fn() }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: mock.getDoc }));
vi.mock("./components/AdminDashboard", () => ({ AdminDashboard: () => <h1>Quản trị tất cả salon</h1> }));
vi.mock("./components/LoginView", () => ({ LoginView: () => <h1>Đăng nhập quản trị</h1> }));
let notify: (user: User | null) => void;
const admin = { uid: "separate-admin", email: "admin@example.test" } as User;

beforeEach(() => {
  vi.clearAllMocks();
  mock.subscribe.mockImplementation((_auth, callback) => { notify = callback; return vi.fn(); });
  mock.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "owner", isActive: true }) });
  mock.access.mockResolvedValue({ authorized: true, repairsEnabled: true });
});

describe("admin authority is verified by the server", () => {
  it("accepts a separate admin grant without changing the existing owner profile", async () => {
    render(<App />); await act(async () => notify(admin));
    expect(await screen.findByRole("heading", { name: "Quản trị tất cả salon" })).toBeVisible();
    expect(mock.access).toHaveBeenCalled();
  });
  it("shows a recoverable verification error rather than an endless loading screen", async () => {
    mock.access.mockRejectedValue({ code: "functions/unavailable" });
    render(<App />); await act(async () => notify(admin));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa xác minh được quyền quản trị/);
  });
  it("does not restore admin content from an old response after sign-out", async () => {
    let complete!: (value: unknown) => void;
    mock.access.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<App />); await act(async () => notify(admin));
    await act(async () => notify(null));
    expect(await screen.findByRole("heading", { name: "Đăng nhập quản trị" })).toBeVisible();
    if (complete) await act(async () => complete({ authorized: true }));
    expect(screen.queryByRole("heading", { name: "Quản trị tất cả salon" })).not.toBeInTheDocument();
  });
});
