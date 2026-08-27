export function zmpLoginUrl(value) {
  return String(value || "");
}

export function salonTestingUrl(value, version = "20") {
  const input = String(value || "");
  if (!input) {
    return input;
  }

  try {
    const url = new URL(input);
    url.searchParams.set("env", "TESTING");
    url.searchParams.set("version", version);
    return url.toString();
  } catch {
    const separator = input.includes("?") ? "&" : "?";
    return `${input}${separator}env=TESTING&version=${encodeURIComponent(version)}`;
  }
}
