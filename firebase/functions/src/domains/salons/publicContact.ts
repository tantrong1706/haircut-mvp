import { HttpsError } from "firebase-functions/v2/https";

type Fields = { hotline?: unknown; openingHours?: unknown };
const switchKeys = [
  "showLogo",
  "showHotline",
  "showOpeningHours",
  "showBranchAddress",
  "showDirections",
  "acceptWebPointRequests",
  "allowWebWheel",
] as const;
type SwitchKey = (typeof switchKeys)[number];
type SwitchFields = Partial<Record<SwitchKey, unknown>>;
export type SalonOwnerSwitches = Record<SwitchKey, boolean>;

export function parseSalonSwitchPatch(input: SwitchFields): Partial<SalonOwnerSwitches> {
  const patch: Partial<SalonOwnerSwitches> = {};
  for (const key of switchKeys) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      throw new HttpsError("invalid-argument", "Công tắc phải là Bật hoặc Tắt.");
    }
    patch[key] = value;
  }
  return patch;
}

export function salonOwnerSwitches(data: SwitchFields | undefined): SalonOwnerSwitches {
  const enabled = (key: SwitchKey) => data?.[key] === undefined || data[key] === true;
  return {
    showLogo: enabled("showLogo"),
    showHotline: enabled("showHotline"),
    showOpeningHours: enabled("showOpeningHours"),
    showBranchAddress: enabled("showBranchAddress"),
    showDirections: data?.showDirections === true,
    acceptWebPointRequests: enabled("acceptWebPointRequests"),
    allowWebWheel: enabled("allowWebWheel"),
  };
}

export function webBranchLocation(address: string, settings: SalonOwnerSwitches) {
  return {
    branchAddress: settings.showBranchAddress ? address : "",
    branchDirectionsEnabled:
      settings.showBranchAddress && settings.showDirections && Boolean(address.trim()),
  };
}

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
