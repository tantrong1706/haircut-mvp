import { ExternalLink } from "lucide-react";
import { Section } from "./ScreenPrimitives";

export function PublicSupportLinks() {
  const configuredEmail = String(
    import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL || "tantrong1706@gmail.com",
  ).trim();
  const email = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/iu.test(configuredEmail)
    ? configuredEmail
    : "";
  const publicWebUrl = String(
    import.meta.env.VITE_PUBLIC_WEB_URL || "https://haircut-c7d12.web.app",
  ).replace(/\/+$/, "");
  return (
    <Section title="Hỗ trợ và pháp lý">
      <div className="manager-link-list">
        <a href={`${publicWebUrl}/privacy`} target="_blank" rel="noreferrer">
          Chính sách quyền riêng tư <ExternalLink aria-hidden="true" />
        </a>
        <a href={`${publicWebUrl}/terms`} target="_blank" rel="noreferrer">
          Điều khoản sử dụng <ExternalLink aria-hidden="true" />
        </a>
        {email ? (
          <a href={`mailto:${email}`}>
            Email: {email} <ExternalLink aria-hidden="true" />
          </a>
        ) : (
          <p>Kênh hỗ trợ chung chưa được công bố.</p>
        )}
      </div>
    </Section>
  );
}
