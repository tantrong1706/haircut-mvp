import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyConsentControls } from "./PrivacyConsentControls";
import { readPrivacyPreferences } from "../services/privacyPreferences";
import { LegalInfoPage } from "../pages/LegalInfoPage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("clear, optional monitoring controls", () => {
  it("opens the global controls from the cookie policy", async () => {
    render(
      <>
        <PrivacyConsentControls />
        <LegalInfoPage kind="cookies" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Chỉ dùng thiết yếu" }));
    await userEvent.click(screen.getByRole("button", { name: "Mở cài đặt cookie" }));
    expect(screen.getByRole("button", { name: "Cho phép thống kê" })).toBeVisible();
  });
  it("keeps optional monitoring off and reports a storage failure", async () => {
    render(<PrivacyConsentControls />);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await userEvent.click(screen.getByRole("button", { name: "Cho phép thống kê" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Thống kê vẫn tắt");
    expect(readPrivacyPreferences()).toBeNull();
  });
  it("describes actual disclosure state and permits closing without enabling monitoring", async () => {
    render(<PrivacyConsentControls />);
    const settings = screen.getByRole("button", { name: "Cài đặt quyền riêng tư" });
    expect(settings).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(settings);
    expect(screen.queryByRole("button", { name: "Cho phép thống kê" })).not.toBeInTheDocument();
    expect(readPrivacyPreferences()).toBeNull();
    expect(settings).toHaveAttribute("aria-expanded", "false");
  });
  it("lets a visitor decline as easily as accept, without clearing their login", async () => {
    localStorage.setItem("firebase:authUser:fixture", "preserve-login-fixture");
    render(<PrivacyConsentControls />);
    expect(screen.getByRole("button", { name: "Chỉ dùng thiết yếu" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cho phép thống kê" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Chỉ dùng thiết yếu" }));
    expect(readPrivacyPreferences()?.optional).toBe(false);
    expect(localStorage.getItem("firebase:authUser:fixture")).toBe("preserve-login-fixture");
    expect(screen.queryByRole("button", { name: "Cho phép thống kê" })).not.toBeInTheDocument();
  });

  it("allows reopening settings and withdrawing a previous opt-in", async () => {
    render(<PrivacyConsentControls />);
    await userEvent.click(screen.getByRole("button", { name: "Cho phép thống kê" }));
    expect(readPrivacyPreferences()?.optional).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Cài đặt quyền riêng tư" }));
    await userEvent.click(screen.getByRole("button", { name: "Chỉ dùng thiết yếu" }));
    expect(readPrivacyPreferences()?.optional).toBe(false);
  });
});
