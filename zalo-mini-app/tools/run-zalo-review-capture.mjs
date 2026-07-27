import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..");
const env = {
  ...process.env,
  ...supportEnvironment(resolve(appDir, ".env.production.local")),
  VITE_ZALO_PREVIEW: "true",
  HAIRCUT_CAPTURE_REVIEW_SCREENSHOTS: "1",
};

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Không xác định được npm CLI từ phiên hiện tại.");
}

run(process.execPath, [npmCli, "run", "build:test"]);
run(process.execPath, [
  resolve(appDir, "node_modules", "@playwright", "test", "cli.js"),
  "test",
  "e2e/review-screenshots.spec.ts",
  "--project=desktop-chromium",
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appDir,
    env,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function supportEnvironment(path) {
  if (!existsSync(path)) {
    return {};
  }

  const allowed = new Set(["VITE_SUPPORT_EMAIL", "VITE_SUPPORT_PHONE"]);
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator > 0
          ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
          : ["", ""];
      })
      .filter(([key]) => allowed.has(key)),
  );
}
