import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type MockZaloScenario =
  | "VALID_ID"
  | "INVALID_TOKEN"
  | "MISSING_ID"
  | "MALFORMED_JSON"
  | "TIMEOUT"
  | "CONNECTION_RESET"
  | "408"
  | "429"
  | "500"
  | "503";

export async function startMockZaloServer() {
  const attempts = new Map<string, number>();
  const server = createServer((request, response) => {
    const scenario = String(request.headers.access_token || "VALID_ID") as MockZaloScenario;
    attempts.set(scenario, (attempts.get(scenario) ?? 0) + 1);
    response.setHeader("Content-Type", "application/json");
    if (scenario === "TIMEOUT") return;
    if (scenario === "CONNECTION_RESET") {
      request.socket.destroy();
      return;
    }
    if (scenario === "MALFORMED_JSON") {
      response.end("{");
      return;
    }
    if (scenario === "INVALID_TOKEN") {
      response.statusCode = 401;
      response.end(JSON.stringify({ error: -201 }));
      return;
    }
    if (scenario === "MISSING_ID") {
      response.end(JSON.stringify({ error: 0 }));
      return;
    }
    if (["408", "429", "500", "503"].includes(scenario)) {
      response.statusCode = Number(scenario);
      response.end(JSON.stringify({ error: Number(scenario) }));
      return;
    }
    response.end(JSON.stringify({ error: 0, id: "123456789" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/v2.0/me`,
    attempts,
    close: () =>
      new Promise<void>((resolve, reject) =>
        (server as Server).close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
