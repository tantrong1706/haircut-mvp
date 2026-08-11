import { createGatewayApplication } from "./app.js";
import { loadGatewayConfig } from "./config.js";
import { createSafeLogger } from "./observability/safeLogger.js";
import { SqliteReplayStore } from "./replay/sqliteReplayStore.js";

const config = loadGatewayConfig();
const logger = createSafeLogger();
const replayStore = new SqliteReplayStore(config.replayDbPath);
const application = createGatewayApplication({
  keys: config.keys,
  replayStore,
  requestMaxBytes: config.requestMaxBytes,
  logger,
  upstreamUrl: config.upstreamUrl,
  version: config.version,
});

application.server.listen(config.port, "127.0.0.1", () => {
  logger.info("gateway_started", { port: config.port });
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("gateway_shutdown_started", { signal });
  const forcedExit = setTimeout(() => {
    logger.error("gateway_shutdown_timeout", { signal });
    process.exitCode = 1;
  }, 10_000);
  forcedExit.unref();
  try {
    await application.close();
    logger.info("gateway_shutdown_completed", { signal });
  } catch {
    logger.error("gateway_shutdown_failed", { signal });
    process.exitCode = 1;
  } finally {
    clearTimeout(forcedExit);
  }
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
