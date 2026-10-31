// Test-only transport: production code does not import this module or inherit its child env.
export function emulatorTestEnvironment(parent) {
  if (!/^demo-[a-z0-9][a-z0-9-]*$/u.test(parent.GCLOUD_PROJECT ?? ""))
    throw new Error("Integration tests require an explicit demo-* project");
  const endpoint = new URL(`http://${parent.FIRESTORE_EMULATOR_HOST || "invalid"}`);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) ||
    !endpoint.port ||
    endpoint.pathname !== "/" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error("Integration tests require an explicit loopback Firestore emulator");
  return { ...parent, FIRESTORE_PREFER_REST: "true" };
}
