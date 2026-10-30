import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LegalInfoPage } from "./LegalInfoPage";

afterEach(() => vi.unstubAllEnvs());
describe("public customer privacy information", () => {
  it("explains essential browser storage separately from optional monitoring", () => {
    render(<LegalInfoPage kind="cookies" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Cookie và lưu trữ trên thiết bị" }),
    ).toBeVisible();
    expect(screen.getByText(/IndexedDB/)).toBeVisible();
    expect(screen.getByText(/Google Analytics, Firebase Performance/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Mở cài đặt cookie" })).toBeEnabled();
  });
  it("offers access, correction and deletion requests without demanding a manager login", () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "support@example.invalid");
    render(<LegalInfoPage kind="data-rights" />);
    for (const label of ["Yêu cầu xem dữ liệu", "Yêu cầu sửa dữ liệu", "Yêu cầu xóa dữ liệu"]) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toMatch(/^mailto:support@example\.invalid\?subject=/);
      expect(link.getAttribute("href")).not.toContain("qrToken");
    }
    expect(screen.getByText(/Không gửi mật khẩu, OTP/)).toBeVisible();
  });
  it("does not invent a request mailbox when no public channel has been approved", () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "not-a-mailbox");
    vi.stubEnv("VITE_SUPPORT_EMAIL", "private.operator@example.invalid");
    render(<LegalInfoPage kind="data-rights" />);
    expect(
      screen
        .queryAllByRole("link")
        .filter((link) => /^mailto:/u.test(link.getAttribute("href") || "")),
    ).toHaveLength(0);
    expect(screen.getAllByText(/liên hệ trực tiếp salon/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Các liên kết mở ứng dụng email/)).not.toBeInTheDocument();
  });
  it("does not invent a paid plan, refund guarantee or payment collection", () => {
    render(<LegalInfoPage kind="service" />);
    expect(screen.getByRole("heading", { level: 1, name: "Chính sách dịch vụ" })).toBeVisible();
    expect(screen.getByText(/chưa thu phí/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /thanh toán|mua ngay/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/hoàn tiền vô điều kiện/i)).not.toBeInTheDocument();
  });
});
