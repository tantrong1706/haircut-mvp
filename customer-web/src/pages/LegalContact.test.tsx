import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrivacyPage } from "./PrivacyPage";
import { TermsPage } from "./TermsPage";

afterEach(() => vi.unstubAllEnvs());
describe("approved public support channel", () => {
  it("does not treat requesting points as consent to photographs", () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/Khi bấm nút, khách đồng ý/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Yêu cầu.*xóa/i })).toHaveAttribute(
      "href",
      "/data-rights",
    );
  });
  it("does not turn continued use into optional data-processing consent", () => {
    render(<TermsPage />);
    expect(screen.queryByText(/việc tiếp tục sử dụng sau khi/i)).not.toBeInTheDocument();
  });
  it.each([PrivacyPage, TermsPage])(
    "publishes only the approved support email without personal identity or phone",
    (Page) => {
      vi.stubEnv("VITE_SUPPORT_EMAIL", "");
      vi.stubEnv("VITE_SUPPORT_PHONE", "");
      vi.stubEnv("VITE_OPERATOR_LEGAL_NAME", "");
      vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "");
      render(<Page />);
      expect(screen.queryByText(/Đơn vị vận hành:|Điện thoại hỗ trợ:/)).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "tantrong1706@gmail.com" })).toHaveAttribute(
        "href",
        "mailto:tantrong1706@gmail.com",
      );
      expect(
        screen
          .queryAllByRole("link")
          .filter((link) => /^tel:/u.test(link.getAttribute("href") || "")),
      ).toHaveLength(0);
    },
  );
});
