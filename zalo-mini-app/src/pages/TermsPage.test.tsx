import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "./PrivacyPage";
import { TermsPage } from "./TermsPage";

describe("trang pháp lý công khai", () => {
  it("hiển thị điều khoản phù hợp với chức năng CH Haircut Salon", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Điều khoản sử dụng" })).toBeInTheDocument();
    expect(screen.getByText(/quản lý chi nhánh, hàng chờ, lịch sử phục vụ/i)).toBeInTheDocument();
    const privacyLinks = screen.getAllByRole("link", { name: "Chính sách quyền riêng tư" });
    expect(privacyLinks.length).toBeGreaterThan(0);
    privacyLinks.forEach((link) => expect(link).toHaveAttribute("href", "/privacy"));
    expect(
      screen.getByRole("link", { name: "Hướng dẫn yêu cầu xem, sửa hoặc xóa dữ liệu" }),
    ).toHaveAttribute("href", "/privacy#data-rights");
    expect(
      screen.queryByRole("link", { name: /xóa tài khoản hoặc salon/i }),
    ).not.toBeInTheDocument();
  });

  it("liên kết từ chính sách quyền riêng tư sang điều khoản", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("link", { name: "Đọc Điều khoản sử dụng của CH Haircut Salon" }),
    ).toHaveAttribute("href", "/terms");
  });
});
