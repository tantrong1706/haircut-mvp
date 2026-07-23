import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(scriptDir, "../../../packages/contracts");
const targetDir = resolve(scriptDir, "../contracts");
const files = ["package.json", "index.js", "index.d.ts", "README.md"];
const shouldWrite = process.argv.includes("--write");

await mkdir(targetDir, { recursive: true });

const mismatches = [];
for (const file of files) {
  const source = await readFile(resolve(sourceDir, file), "utf8");
  const targetPath = resolve(targetDir, file);

  if (shouldWrite) {
    await writeFile(targetPath, source, "utf8");
    continue;
  }

  const target = await readFile(targetPath, "utf8").catch(() => "");
  if (target !== source) mismatches.push(file);
}

if (mismatches.length > 0) {
  throw new Error(
    `Contracts dùng để deploy đã lệch source: ${mismatches.join(", ")}. ` +
      "Chạy npm run sync:contracts trong firebase/functions.",
  );
}

console.log(
  shouldWrite
    ? "Đã đồng bộ contracts vào gói Functions."
    : "Contracts dùng để deploy đang đồng bộ với source.",
);
