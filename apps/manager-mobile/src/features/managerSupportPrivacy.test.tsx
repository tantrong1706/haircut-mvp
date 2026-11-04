import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerSettingsScreen } from "./owner/OwnerSettingsScreen";
import { StaffAccountScreen } from "./staff/StaffAccountScreen";
import type { AppUser } from "../services/managerApi";

afterEach(() => vi.unstubAllEnvs());
const user = {
  uid: "fixture-owner",
  salonId: "fixture-salon",
  name: "Tài khoản mẫu",
  role: "owner",
  isActive: true,
} as AppUser;
function renderAccount(role: "owner" | "staff") {
  if (role === "owner")
    return render(
      <OwnerSettingsScreen
        user={user}
        profile={null}
        biometricEnabled={false}
        nativeReady={false}
        online
        onProfileChange={vi.fn()}
        onOwnerAvatarChange={vi.fn()}
        onToggleBiometric={vi.fn()}
      />,
    );
  return render(
    <StaffAccountScreen
      user={{ ...user, role: "staff" }}
      branchName="Chi nhánh mẫu"
      biometricEnabled={false}
      nativeReady={false}
      online
      onToggleBiometric={vi.fn()}
    />,
  );
}
describe.each(["owner", "staff"] as const)("%s support privacy", (role) => {
  it("does not render a malformed or empty mail link", async () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "invalid\naddress");
    renderAccount(role);
    await userEvent.click(screen.getByRole("button", { name: /Hỗ trợ và pháp lý/ }));
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => /^(mailto:|tel:)/u.test(link.getAttribute("href") || "")),
    ).toHaveLength(0);
    expect(screen.getByText("Kênh hỗ trợ chung chưa được công bố.")).toBeVisible();
  });
  it("publishes only the approved email and ignores stale personal support settings", async () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "");
    vi.stubEnv("VITE_SUPPORT_EMAIL", "private.operator@example.invalid");
    vi.stubEnv("VITE_SUPPORT_PHONE", "0900000000");
    renderAccount(role);
    await userEvent.click(screen.getByRole("button", { name: /Hỗ trợ và pháp lý/ }));
    expect(screen.getByRole("link", { name: /Chính sách quyền riêng tư/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Điều khoản sử dụng/ })).toBeVisible();
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => /^tel:/u.test(link.getAttribute("href") || "")),
    ).toHaveLength(0);
    expect(screen.getByRole("link", { name: /tantrong1706@gmail.com/ })).toHaveAttribute(
      "href",
      "mailto:tantrong1706@gmail.com",
    );
  });
  it("keeps an explicitly approved brand support channel usable", async () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "support@example.invalid");
    vi.stubEnv("VITE_SUPPORT_PHONE", "+84 900 000 000");
    renderAccount(role);
    await userEvent.click(screen.getByRole("button", { name: /Hỗ trợ và pháp lý/ }));
    expect(screen.getByRole("link", { name: /support@example.invalid/ })).toHaveAttribute(
      "href",
      "mailto:support@example.invalid",
    );
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => /^tel:/u.test(link.getAttribute("href") || "")),
    ).toHaveLength(0);
  });
});
