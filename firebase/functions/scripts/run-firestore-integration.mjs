import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { emulatorTestEnvironment } from "./emulator-transport.mjs";
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)),
    ...process.argv.slice(2),
  ],
  {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: emulatorTestEnvironment(process.env),
    stdio: "inherit",
    windowsHide: true,
  },
);
process.exit(result.status ?? 1);
