import { ZaloRequestError, fetchZaloJson, type ZaloFetch } from "./zaloClient";

type DecodeZaloPhoneOptions = {
  endpoint?: string;
  fetchImpl?: ZaloFetch;
};

export async function decodeZaloPhoneNumber(
  accessToken: string,
  phoneToken: string,
  appSecret: string,
  options: DecodeZaloPhoneOptions = {},
) {
  const endpoint = new URL(options.endpoint || "https://graph.zalo.me/v2.0/me/info");
  const result = await fetchZaloJson(
    endpoint,
    {
      access_token: accessToken,
      code: phoneToken,
      secret_key: appSecret,
    },
    {
      fetchImpl: options.fetchImpl,
      maxAttempts: 1,
    },
  );

  const errorCode = Number(result.payload.error ?? 0);
  if (Number.isFinite(errorCode) && errorCode !== 0) {
    throw new ZaloRequestError(
      "Zalo chưa cung cấp được số điện thoại. Vui lòng xác nhận lại.",
      result.status,
      errorCode,
    );
  }

  const data = result.payload.data;
  const rawNumber =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? String((data as Record<string, unknown>).number ?? "")
      : "";
  const phone = rawNumber.replace(/\D/g, "");

  if (!/^\d{9,15}$/.test(phone)) {
    throw new ZaloRequestError(
      "Zalo không trả về số điện thoại hợp lệ. Vui lòng xác nhận lại.",
      result.status,
      "invalid-phone",
    );
  }

  return phone;
}
