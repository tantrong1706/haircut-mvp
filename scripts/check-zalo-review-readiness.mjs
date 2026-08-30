import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(repoRoot, "zalo-mini-app");
const buildRoot = resolve(appRoot, "www");
const expectedMiniAppId = "2038116772828167300";
const expectedMiniAppName = "CH Hair Studio";
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
const qrSource = readText(resolve(appRoot, "src", "services", "qr.ts"));
const submissionText = readText(resolve(repoRoot, "docs", "ZALO_VERSION_8_SUBMISSION.md"));
const reviewChecklistText = readText(resolve(repoRoot, "docs", "ZALO_REVIEW_CHECKLIST.md"));
const staticReadinessText = readText(
  resolve(repoRoot, "docs", "ZALO_VERSION_8_STATIC_READINESS.md"),
);
const currentBrandingText = [
  resolve(appRoot, "index.html"),
  resolve(appRoot, "public", "manifest.webmanifest"),
  resolve(appRoot, "src", "components", "BrandLogo.tsx"),
  resolve(appRoot, "src", "components", "InstallAppPrompt.tsx"),
  resolve(appRoot, "src", "pages", "HomePage.tsx"),
  resolve(appRoot, "src", "pages", "PrivacyPage.tsx"),
  resolve(appRoot, "src", "pages", "ScanEntryPage.tsx"),
  resolve(appRoot, "src", "pages", "TermsPage.tsx"),
  resolve(appRoot, "src", "pages", "WheelPage.tsx"),
  resolve(appRoot, "src", "services", "zalo.ts"),
  resolve(repoRoot, "docs", "ZALO_VERSION_8_SUBMISSION.md"),
]
  .map(readText)
  .join("\n");
const miniAppBrandingText = currentBrandingText.replaceAll("HAIRCUT Manager", "");
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
check(
  !qrSource
    .slice(
      qrSource.indexOf("export function hasQrContext"),
      qrSource.indexOf("function removeQrTokenFromUrl"),
    )
    .includes('qr.qrType === "legacy-mirror"'),
  "Runtime Version 8 từ chối QR gương legacy có token thô",
);

const reviewerSteps = Array.from({ length: 14 }, (_, index) => `${index + 1}.`);
check(
  reviewerSteps.every((step) => submissionText.includes(step)),
  "Hồ sơ reviewer có đủ luồng 14 bước",
);
const reviewerPlaceholders = [
  "[TÊN_SALON_DEMO]",
  "[TÊN_CHI_NHÁNH_DEMO]",
  "[DEEPLINK_REVIEW_HỢP_LỆ]",
  "[QR_REVIEW_HỢP_LỆ]",
];
const reviewerDataDeferred = reviewerPlaceholders.every((placeholder) => {
  const line = submissionText.split(/\r?\n/u).find((value) => value.includes(placeholder));
  return line?.includes("FILL_AFTER_VN_GATEWAY_AND_FINAL_TESTING_DEPLOY") === true;
});
const reviewerDataCompleted =
  reviewerPlaceholders.every((placeholder) => !submissionText.includes(placeholder)) &&
  submissionText.includes("Salon demo: CH Haircut Salon - Xét duyệt Zalo") &&
  submissionText.includes("Testing version: 21") &&
  submissionText.includes("QR testing: https://app.chhaircutsalon.cc/review-salon-v21.png") &&
  !/\b(?:qrToken|mirrorId)=/u.test(submissionText);
check(
  reviewerDataDeferred || reviewerDataCompleted,
  "Dữ liệu reviewer được deferred an toàn hoặc hoàn tất",
);
const screenshotNames = [
  "01-open",
  "02-salon-qr",
  "03-branch-selector",
  "04-branch",
  "05-profile-explanation",
  "06-zalo-permission",
  "07-checkin",
  "08-waiting",
  "09-serving",
  "10-points",
  "11-history",
  "12-wheel-before",
  "13-wheel-result",
  "14-reward",
  "15-privacy",
  "16-terms",
];
check(
  screenshotNames.every((name) => reviewChecklistText.includes(name)) &&
    ["READY_TO_CAPTURE", "BLOCKED_BY_VN_GATEWAY", "NOT_REQUIRED", "CAPTURED"].every((status) =>
      reviewChecklistText.includes(status),
    ),
  "Checklist reviewer định danh đủ 16 ảnh và trạng thái hợp lệ",
);
check(
  staticReadinessText.includes("REVIEW_DATA_SETUP_REQUIRED=true") &&
    staticReadinessText.includes("POST /v1/zalo/verify") &&
    staticReadinessText.includes("GET /health") &&
    staticReadinessText.includes("Phase 2") &&
    staticReadinessText.includes("Redis"),
  "Có spec dữ liệu reviewer và thiết kế gateway nhiều instance",
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
    sourceConfig.app?.title === expectedMiniAppName &&
      sourceConfig.app?.headerTitle === expectedMiniAppName,
    `Tên Mini App nguồn là ${expectedMiniAppName}`,
  );
  check(
    outputConfig.app?.title === expectedMiniAppName &&
      outputConfig.app?.headerTitle === expectedMiniAppName,
    `Tên Mini App build là ${expectedMiniAppName}`,
  );
  check(
    !/\bHAIRCUT\b/u.test(JSON.stringify(sourceConfig)) &&
      !/CH Haircut Salon/iu.test(JSON.stringify(sourceConfig)),
    "app-config không dùng branding Mini App cũ",
  );
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

check(
  !/\bHAIRCUT\b/u.test(miniAppBrandingText),
  "Runtime và hồ sơ Version 8 không còn branding ứng dụng cũ HAIRCUT",
);
check(
  currentBrandingText.includes(expectedMiniAppName),
  `Runtime và hồ sơ Version 8 dùng ${expectedMiniAppName}`,
);

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
  "Code Mini App không có endpoint localhost",
);
check(
  !/http:\/\/(?!(?:www\.w3\.org\/2000\/svg|www\.apache\.org\/licenses))/iu.test(
    firstPartyBundleText,
  ),
  "Code Mini App không có endpoint HTTP không mã hóa",
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
