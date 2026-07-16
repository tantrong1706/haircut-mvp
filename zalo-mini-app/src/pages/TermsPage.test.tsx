import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "./PrivacyPage";
import { TermsPage } from "./TermsPage";

describe("trang pháp lý công khai", () => {
  it("hiển thị điều khoản phù hợp với chức năng HAIRCUT", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "Điều khoản sử dụng" })).toBeInTheDocument();
    expect(screen.getByText(/quản lý chi nhánh, hàng chờ, lịch sử phục vụ/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("liên kết từ chính sách quyền riêng tư sang điều khoản", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("link", { name: "Đọc Điều khoản sử dụng của HAIRCUT" }),
    ).toHaveAttribute("href", "/terms");
  });
});
