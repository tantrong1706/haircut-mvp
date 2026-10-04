const CREDENTIAL_NAME =
  "(?:qr[_-]?token|access[_-]?token|appsecret[_-]?proof|id[_-]?token|refresh[_-]?token|token|oob[_-]?code|verification[_-]?code|password|otp|authorization)";
const CREDENTIAL_KEY = new RegExp(`^${CREDENTIAL_NAME}$`, "i");

function redactUrlCredentials(value: string) {
  return value.replace(new RegExp(`([?&#]${CREDENTIAL_NAME}=)[^&#\\s]*`, "gi"), "$1[redacted]");
}

export function redactSensitiveUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (CREDENTIAL_KEY.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    });
    url.hash = redactUrlCredentials(url.hash);
    if (url.username) url.username = "[redacted]";
    if (url.password) url.password = "[redacted]";
    return url.toString();
  } catch {
    return redactUrlCredentials(value);
  }
}

export function redactSensitiveText(value: string) {
  return redactUrlCredentials(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(
      new RegExp(
        `(\\b${CREDENTIAL_NAME}\\b["']?\\s*[:=]\\s*)(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|[^\\s,"'}]+)`,
        "gi",
      ),
      "$1[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?84|0)(?:[ .-]?\d){8,10}\b/g, "[phone]")
    .replace(/\b(?:HC|HAIRCUT)-[A-Z0-9-]{6,}\b/gi, "[reward-code]");
}
