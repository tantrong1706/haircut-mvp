import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Vite hiện đang build vào thư mục www, không phải dist.
const buildDirName = "www";
const buildDir = resolve(projectDir, buildDirName);

const manifestPath = resolve(buildDir, ".vite", "manifest.json");
const sourceConfigPath = resolve(projectDir, "app-config.json");
const outputConfigPath = resolve(buildDir, "app-config.json");

const mode = process.argv.includes("--check") ? "check" : "write";

if (!existsSync(manifestPath)) {
  throw new Error(`Thiếu ${buildDirName}/.vite/manifest.json. Hãy chạy npm run build:web trước.`);
}

if (!existsSync(sourceConfigPath)) {
  throw new Error("Không tìm thấy app-config.json tại thư mục dự án.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const entries = Object.values(manifest).filter(
  (item) => item && typeof item === "object" && item.isEntry === true,
);

if (entries.length !== 1) {
  throw new Error(`Cần đúng 1 entry trong Vite manifest, hiện có ${entries.length}.`);
}

const entry = entries[0];

if (typeof entry.file !== "string" || !entry.file) {
  throw new Error("Vite manifest không có file JavaScript entry hợp lệ.");
}

const listSyncJS = [`./${entry.file}`];

const listCSS = Array.isArray(entry.css) ? entry.css.map((file) => `./${file}`) : [];

if (!listSyncJS[0].endsWith(".module.js")) {
  throw new Error(`Entry ZMP phải có đuôi .module.js: ${listSyncJS[0]}`);
}

if (listCSS.length === 0) {
  throw new Error("Vite manifest không có file CSS cho entry.");
}

// Kiểm tra các asset khai báo thực sự tồn tại trong www.
for (const file of [...listSyncJS, ...listCSS]) {
  const relativePath = file.replace(/^\.\//, "");
  const absolutePath = resolve(buildDir, relativePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`app-config.json trỏ tới file không tồn tại: ${file}`);
  }
}

const current = JSON.parse(readFileSync(sourceConfigPath, "utf8"));

const expected = {
  ...current,
  listCSS,
  listSyncJS,
  listAsyncJS: [],
};

const serialized = `${JSON.stringify(expected, null, 2)}\n`;
const currentSerialized = `${JSON.stringify(current, null, 2)}\n`;

if (mode === "check") {
  if (serialized !== currentSerialized) {
    throw new Error(
      "app-config.json tại thư mục dự án chưa khớp bản build. Hãy chạy npm run sync:zmp.",
    );
  }

  if (!existsSync(outputConfigPath)) {
    throw new Error(`Thiếu ${buildDirName}/app-config.json. Hãy chạy npm run sync:zmp.`);
  }

  const outputSerialized = `${JSON.stringify(
    JSON.parse(readFileSync(outputConfigPath, "utf8")),
    null,
    2,
  )}\n`;

  if (outputSerialized !== serialized) {
    throw new Error(
      `${buildDirName}/app-config.json chưa khớp bản build. Hãy chạy npm run sync:zmp.`,
    );
  }

  console.log(`app-config.json hợp lệ và mọi asset ZMP trong ${buildDirName} đều tồn tại.`);
} else {
  if (serialized !== currentSerialized) {
    writeFileSync(sourceConfigPath, serialized, "utf8");
    console.log("Đã cập nhật app-config.json tại thư mục dự án.");
  } else {
    console.log("app-config.json tại thư mục dự án đã khớp Vite manifest.");
  }

  // Đảm bảo app-config.json nằm ngay trong thư mục www để ZMP deploy.
  writeFileSync(outputConfigPath, serialized, "utf8");

  console.log(`Đã đồng bộ ${buildDirName}/app-config.json từ Vite manifest.`);
}
