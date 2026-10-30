import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicContact } from "./PublicContact";
import { publicContact } from "../config/publicContact";

beforeEach(() => {
  for (const key of [
    "VITE_PUBLIC_SUPPORT_EMAIL",
    "VITE_OPERATOR_LEGAL_NAME",
    "VITE_OPERATOR_ADDRESS",
    "VITE_SUPPORT_PHONE",
    "VITE_SUPPORT_EMAIL",
  ])
    vi.stubEnv(key, "");
});
afterEach(() => vi.unstubAllEnvs());
describe("only the approved support email is public", () => {
  it("shows the approved email without the operator identity, hotline or address", () => {
    expect(publicContact()).toEqual({
      email: "tantrong1706@gmail.com",
      phone: "",
      legalName: "",
      address: "",
    });
    render(<PublicContact />);
    expect(screen.getByRole("link", { name: "tantrong1706@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:tantrong1706@gmail.com",
    );
    expect(screen.queryByText(/Đơn vị vận hành:|Địa chỉ liên hệ:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Điện thoại hỗ trợ:/)).not.toBeInTheDocument();
  });
  it("ignores stale contact configuration when publication is not enabled", () => {
    vi.stubEnv("VITE_SUPPORT_EMAIL", "private.operator@example.invalid");
    vi.stubEnv("VITE_SUPPORT_PHONE", "0900000000");
    vi.stubEnv("VITE_OPERATOR_LEGAL_NAME", "Cá nhân kiểm thử");
    vi.stubEnv("VITE_OPERATOR_ADDRESS", "Địa chỉ riêng kiểm thử");
    render(<PublicContact />);
    expect(
      screen.queryAllByText(/private.operator|0900000000|Cá nhân kiểm thử|Địa chỉ riêng/),
    ).toHaveLength(0);
    expect(publicContact()).toEqual({
      email: "tantrong1706@gmail.com",
      phone: "",
      legalName: "",
      address: "",
    });
  });
  it("accepts a dedicated public support email but never publishes legacy identity settings", () => {
    vi.stubEnv("VITE_OPERATOR_LEGAL_NAME", "Đơn vị kiểm thử");
    vi.stubEnv("VITE_OPERATOR_ADDRESS", "Địa chỉ kiểm thử");
    vi.stubEnv("VITE_SUPPORT_PHONE", "+84 900 000 000");
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "support@example.invalid");
    render(<PublicContact />);
    expect(screen.queryAllByText(/Đơn vị kiểm thử|Địa chỉ kiểm thử|\+84 900 000 000/)).toHaveLength(
      0,
    );
    expect(screen.getByRole("link", { name: "support@example.invalid" })).toHaveAttribute(
      "href",
      "mailto:support@example.invalid",
    );
  });
  it("does not replace invalid configuration with personal details", () => {
    vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "unsafe\nbcc@example.invalid");
    vi.stubEnv("VITE_SUPPORT_PHONE", "<script>");
    expect(publicContact().email).toBe("");
    expect(publicContact().phone).toBe("");
    render(<PublicContact />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/liên hệ trực tiếp salon/i)).toBeVisible();
  });
});
