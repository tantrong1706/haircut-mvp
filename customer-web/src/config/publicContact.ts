export const APPROVED_SUPPORT_EMAIL = "tantrong1706@gmail.com";

export function publicContact() {
  // Only the support email is approved. Never revive legacy personal contact settings.
  const configuredEmail = String(
    import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL || APPROVED_SUPPORT_EMAIL,
  ).trim();
  return {
    email: /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/iu.test(configuredEmail) ? configuredEmail : "",
    phone: "",
    legalName: "",
    address: "",
  };
}
