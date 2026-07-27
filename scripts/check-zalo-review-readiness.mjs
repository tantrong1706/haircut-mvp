import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(repoRoot, "zalo-mini-app");
const buildRoot = resolve(appRoot, "www");
const expectedMiniAppId = "2038116772828167300";
const maxAssetBytes = 500 * 1024;
const failures = [];
const passed = [];

function check(condition, label, detail = "") {
  if (condition) {
    passed.push(label);
    return;
  }

  failures.push(detail ? `${label}: ${detail}` : label);
}

function readText(path) {
  if (!existsSync(path)) {
    failures.push(`Thiếu file: ${relative(repoRoot, path)}`);
    return "";
  }

  return readFileSync(path, "utf8");
}

function parseEnv(text) {
  const values = new Map();

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }

  return values;
}

function listFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

const productionEnv = new Map();
for (const envPath of [".env.production", ".env.production.local"]) {
  const absolutePath = resolve(appRoot, envPath);
  if (existsSync(absolutePath)) {
    for (const [key, value] of parseEnv(readFileSync(absolutePath, "utf8"))) {
      productionEnv.set(key, value);
    }
  }
}
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("VITE_") && typeof value === "string") {
    productionEnv.set(key, value);
  }
}
check(
  productionEnv.get("VITE_ZALO_MINI_APP_ID") === expectedMiniAppId,
  "Mini App ID production chính xác",
  "Cấu hình qua biến CI hoặc .env.production.local",
);
check(productionEnv.get("VITE_ZALO_PREVIEW") !== "true", "Production không bật danh tính preview");
check(productionEnv.get("VITE_APP_ENV") === "production", "Môi trường build là production");

const appSource = readText(resolve(appRoot, "src", "App.tsx"));
const scanEntrySource = readText(resolve(appRoot, "src", "pages", "ScanEntryPage.tsx"));
const zaloSource = readText(resolve(appRoot, "src", "services", "zalo.ts"));
check(appSource.includes('"/privacy"'), "Có route Privacy");
check(appSource.includes('"/terms"'), "Có route Terms");
check(existsSync(resolve(appRoot, "src", "pages", "PrivacyPage.tsx")), "Có trang Privacy");
check(existsSync(resolve(appRoot, "src", "pages", "TermsPage.tsx")), "Có trang Terms");
check(
  !/\b(?:getPhoneNumber|requestPhoneToken)\b/u.test(`${scanEntrySource}\n${zaloSource}`),
  "Frontend không yêu cầu quyền số điện thoại Zalo",
);
check(
  appSource.includes("managementRoutes") && appSource.includes("isZaloMiniAppRuntime"),
  "Route quản lý được tách khỏi runtime khách Zalo",
);
check(
  scanEntrySource.includes("entry-help-links") && scanEntrySource.includes("isZaloRuntime ?"),
  "Link chung không QR có hướng dẫn khách an toàn",
);

const sourceProductionText = `${appSource}\n${scanEntrySource}\n${zaloSource}`;
check(
  !/\[(?:DEEPLINK|QR|TÊN_SALON|TÊN_CHI_NHÁNH)_REVIEW/iu.test(sourceProductionText),
  "Source production không chứa placeholder hồ sơ",
);

const sourceConfigPath = resolve(appRoot, "app-config.json");
const outputConfigPath = resolve(buildRoot, "app-config.json");
let sourceConfig = null;
let outputConfig = null;

try {
  sourceConfig = JSON.parse(readText(sourceConfigPath));
  outputConfig = JSON.parse(readText(outputConfigPath));
} catch (error) {
  failures.push(`app-config.json không hợp lệ: ${error instanceof Error ? error.message : error}`);
}

if (sourceConfig && outputConfig) {
  check(
    JSON.stringify(sourceConfig) === JSON.stringify(outputConfig),
    "app-config nguồn khớp bản build",
  );

  const declaredAssets = [
    ...(Array.isArray(outputConfig.listCSS) ? outputConfig.listCSS : []),
    ...(Array.isArray(outputConfig.listSyncJS) ? outputConfig.listSyncJS : []),
    ...(Array.isArray(outputConfig.listAsyncJS) ? outputConfig.listAsyncJS : []),
  ];
  check(declaredAssets.length > 0, "app-config khai báo asset ZMP");

  for (const asset of declaredAssets) {
    const normalized = String(asset).replace(/^\.\//u, "");
    const absolute = resolve(buildRoot, normalized);
    check(
      absolute.startsWith(`${buildRoot}\\`) || absolute.startsWith(`${buildRoot}/`),
      `Asset nằm trong www: ${asset}`,
    );
    check(existsSync(absolute), `Asset tồn tại: ${asset}`);
  }
}

const bundleFiles = listFiles(buildRoot).filter((path) =>
  [".css", ".html", ".js", ".json"].includes(extname(path).toLowerCase()),
);
check(bundleFiles.length > 0, "Đã có artifact ZMP trong www");

const bundleText = bundleFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const firstPartyBundleText = bundleFiles
  .filter((path) => !/^(?:firebase-|vendor)/u.test(relative(resolve(buildRoot, "assets"), path)))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
check(
  !/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/iu.test(firstPartyBundleText),
  "Code HAIRCUT không có endpoint localhost",
);
check(
  !/http:\/\/(?!(?:www\.w3\.org\/2000\/svg|www\.apache\.org\/licenses))/iu.test(
    firstPartyBundleText,
  ),
  "Code HAIRCUT không có endpoint HTTP không mã hóa",
);
check(
  !/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{20,}|sk-(?:live|proj)-[A-Za-z0-9_-]{16,})/u.test(
    bundleText,
  ),
  "Bundle không chứa mẫu secret riêng tư",
);
check(!/\bQR test\b/iu.test(bundleText), 'Bundle không chứa nội dung "QR test"');
check(
  !/(?:testflight\.apple\.com\/join|play\.google\.com\/store\/apps\/details\?id=(?!com\.zing\.zalo)|apps\.apple\.com\/.+haircut)/iu.test(
    firstPartyBundleText,
  ),
  "Bundle khách không có link tải HAIRCUT Manager",
);

const oversizedAssets = bundleFiles
  .map((path) => ({ path, size: statSync(path).size }))
  .filter(({ size }) => size > maxAssetBytes);
check(
  oversizedAssets.length === 0,
  "Mỗi asset không vượt 500 KB",
  oversizedAssets
    .map(({ path, size }) => `${relative(buildRoot, path)} (${size} bytes)`)
    .join(", "),
);

for (const label of passed) {
  console.log(`PASS ${label}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Zalo review readiness đạt ${passed.length}/${passed.length} kiểm tra.`);
}
