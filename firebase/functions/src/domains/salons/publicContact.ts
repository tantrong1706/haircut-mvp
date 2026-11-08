import { HttpsError } from "firebase-functions/v2/https";

type Fields = { hotline?: unknown; openingHours?: unknown };

function hotlineValid(value: string) {
  return (
    value.length <= 30 &&
    /^\+?[0-9 .()-]+$/.test(value) &&
    /^[0-9]{7,15}$/.test(value.replace(/\D/g, ""))
  );
}

function hoursValid(value: string) {
  return value.length <= 160 && !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value);
}

export function parseSalonPublicContactPatch(input: Fields) {
  const patch: { hotline?: string | null; openingHours?: string | null } = {};
  if (input.hotline !== undefined) {
    if (
      typeof input.hotline !== "string" ||
      (input.hotline.trim() && !hotlineValid(input.hotline.trim()))
    ) {
      throw new HttpsError("invalid-argument", "Hotline phải có từ 7 đến 15 chữ số.");
    }
    patch.hotline = input.hotline.trim() || null;
  }
  if (input.openingHours !== undefined) {
    if (typeof input.openingHours !== "string" || !hoursValid(input.openingHours.trim())) {
      throw new HttpsError(
        "invalid-argument",
        "Giờ mở cửa phải nằm trên một dòng, tối đa 160 ký tự.",
      );
    }
    patch.openingHours = input.openingHours.trim() || null;
  }
  return patch;
}

export function salonPublicContact(data: Fields | undefined) {
  const hotline = typeof data?.hotline === "string" ? data.hotline.trim() : "";
  const openingHours = typeof data?.openingHours === "string" ? data.openingHours.trim() : "";
  return {
    // Never fall back to the old phone field; only an explicitly supplied hotline is public.
    hotline: hotlineValid(hotline) ? hotline : "",
    openingHours: hoursValid(openingHours) ? openingHours : "",
  };
}
