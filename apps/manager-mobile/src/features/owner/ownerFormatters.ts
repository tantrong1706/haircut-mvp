export function ownerPhoneLabel(customer: { phone?: string; phoneLast4: string }) {
  const digits = String(customer.phone || "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) return `0${digits.slice(2)}`;
  if (digits) return digits;
  return customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có SĐT";
}

export function formatInactiveDays(days: number) {
  return days >= 999 ? "Chưa quay lại" : `${days} ngày`;
}

export function formatUploadSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "haircut"
  );
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
