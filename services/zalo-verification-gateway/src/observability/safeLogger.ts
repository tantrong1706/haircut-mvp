const SENSITIVE_KEYS = new Set([
  "accesstoken",
  "appsecretproof",
  "appsecret",
  "authorization",
  "signature",
  "secret",
  "xsignature",
]);

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("accesstoken") ||
    normalized.includes("appsecretproof") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("signature")
  );
}

export type LogFields = Record<string, unknown>;
export type SafeLogger = {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
};

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): any {
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry, seen));
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? "[redacted]" : redactSensitive(entry, seen);
  }
  return output;
}

export function createSafeLogger(sink: (line: string) => void = console.log): SafeLogger {
  const write = (level: string, event: string, fields: LogFields = {}) => {
    sink(
      JSON.stringify(
        redactSensitive({
          level,
          event,
          timestamp: new Date().toISOString(),
          ...fields,
        }),
      ),
    );
  };
  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
