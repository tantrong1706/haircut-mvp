export function ownerPhoneLabel(customer: { phone?: string; phoneLast4: string }) {
  const digits = String(customer.phone || "").replace(/\D/g, "");

  if (digits.startsWith("84") && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  if (digits) {
    return digits;
  }

  return customer.phoneLast4 ? `******${customer.phoneLast4}` : "Chưa có SĐT";
}
