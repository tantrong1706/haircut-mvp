import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { PublicSupportLinks } from "./PublicSupportLinks";

afterEach(() => vi.unstubAllEnvs());
it("renders only the approved email by default, not legacy personal contacts", () => {
  vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "");
  vi.stubEnv("VITE_SUPPORT_EMAIL", "private.operator@example.invalid");
  vi.stubEnv("VITE_SUPPORT_PHONE", "0900000000");
  const html = renderToStaticMarkup(<PublicSupportLinks />);
  expect(html).toContain("mailto:tantrong1706@gmail.com");
  expect(html).not.toMatch(/private.operator|0900000000|tel:/u);
});
it("renders a valid explicit public support email and preserves the legal links", () => {
  vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "support@example.invalid");
  const html = renderToStaticMarkup(<PublicSupportLinks />);
  expect(html).toContain("mailto:support@example.invalid");
  expect(html).toContain("/privacy");
  expect(html).toContain("/terms");
});
it("does not render a mail action when public email configuration is invalid", () => {
  vi.stubEnv("VITE_PUBLIC_SUPPORT_EMAIL", "not-a-mailbox");
  const html = renderToStaticMarkup(<PublicSupportLinks />);
  expect(html).not.toMatch(/mailto:|tel:/u);
  expect(html).toContain("Kênh hỗ trợ chung chưa được công bố.");
});
