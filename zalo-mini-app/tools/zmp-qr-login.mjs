import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { zmpLoginUrl } from "./zmp-url.mjs";

const envPath = resolve(".env");
const qrPath = resolve("qr-zmp-login-dev.png");
const env = readEnv(envPath);
const appId = env.APP_ID || env.VITE_ZALO_MINI_APP_ID;

if (!appId) {
  throw new Error("Thiếu APP_ID trong zalo-mini-app/.env.");
}

const loginRequest = await apiGet(
  `https://zmp-api.developers.zalo.me/admin/request-login?appId=${encodeURIComponent(appId)}`,
);
const loginUrl = zmpLoginUrl(loginRequest?.data?.loginUrl);
const loginKey = String(loginRequest?.data?.zmpsk || "");

if (Number(loginRequest?.err) < 0 || !loginUrl || !loginKey) {
  throw new Error("Zalo không tạo được QR đăng nhập ZMP.");
}

await QRCode.toFile(qrPath, loginUrl, {
  width: 900,
  margin: 4,
  errorCorrectionLevel: "H",
  color: { dark: "#111111", light: "#ffffff" },
});
console.log(`ZMP_LOGIN_QR_READY:${qrPath}`);

const expiresAt = Date.now() + 3 * 60 * 1000;
let jwt = "";

while (Date.now() < expiresAt) {
  await delay(2000);
  const status = await apiGet(
    `https://zmp-api.developers.zalo.me/admin/get-login-status?zmpsk=${encodeURIComponent(loginKey)}`,
  );
  const errorCode = Number(status?.err);

  if (errorCode >= 0 && status?.data?.jwt) {
    jwt = String(status.data.jwt);
    break;
  }
  if (errorCode === -2001) {
    throw new Error("Tài khoản Zalo không có quyền với Mini App này.");
  }
  if (errorCode === -2003) {
    throw new Error("QR đăng nhập ZMP đã hết hạn.");
  }
}

if (!jwt) {
  throw new Error("Chưa xác nhận QR đăng nhập ZMP trong 3 phút.");
}

const payload = decodeJwtPayload(jwt);
if (String(payload.appId || "") !== String(appId)) {
  throw new Error("Phiên ZMP trả về không thuộc Mini App đã cấu hình.");
}

writeEnv(envPath, { APP_ID: appId, ZMP_TOKEN: jwt });
console.log("ZMP_LOGIN_SUCCESS");

async function apiGet(url) {
  const response = await fetch(url, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`ZMP API trả về HTTP ${response.status}.`);
  }
  return response.json();
}

function decodeJwtPayload(value) {
  try {
    return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("ZMP trả về phiên đăng nhập không hợp lệ.");
  }
}

function readEnv(path) {
  if (!existsSync(path)) {
    return {};
  }
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator > 0
          ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
          : ["", ""];
      })
      .filter(([key]) => key),
  );
}

function writeEnv(path, values) {
  const existing = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));
  const next = existing.map((line) => {
    const separator = line.indexOf("=");
    if (separator <= 0) {
      return line;
    }
    const key = line.slice(0, separator).trim();
    if (!pending.has(key)) {
      return line;
    }
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of pending) {
    next.push(`${key}=${value}`);
  }
  writeFileSync(path, `${next.join("\n").replace(/\n+$/, "")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
