import { callCustomerWebFunction } from "./firebase";

export async function withdrawCustomerPhotoPermission(
  salonId: string,
): Promise<{ allowPhoto: false }> {
  if (
    import.meta.env.VITE_APP_ENV === "test" &&
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode ===
      true
  ) {
    return { allowPhoto: false };
  }
  const result = await callCustomerWebFunction<{ salonId: string }, { allowPhoto: boolean }>(
    "withdrawWebCustomerPhotoConsent",
    { salonId },
  );
  if (result.allowPhoto !== false)
    throw new Error("Máy chủ chưa xác nhận ngừng cho phép ảnh. Vui lòng thử lại.");
  return { allowPhoto: false };
}
