import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountDeletionPage } from "./AccountDeletionPage";
import type { AppUser } from "../services/auth";

// Account deletion has its own authorization tests; this test covers the surrounding support text.
vi.mock("../components/AccountDeletionPanel", () => ({ AccountDeletionPanel: () => null }));
afterEach(() => vi.unstubAllEnvs());
it("preserves the signed-in account label without exposing a private support address", () => {
  vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "");
  vi.stubEnv("VITE_SUPPORT_EMAIL", "private.operator@example.invalid");
  render(
    <AccountDeletionPage currentUser={{ name: "Tài khoản kiểm thử", role: "owner" } as AppUser} />,
  );
  expect(screen.getByText("Tài khoản kiểm thử")).toBeVisible();
  expect(screen.queryByText(/private.operator@example.invalid/)).not.toBeInTheDocument();
});
