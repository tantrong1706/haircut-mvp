import assert from "node:assert/strict";
import test from "node:test";
import { salonTestingUrl, zmpLoginUrl } from "./zmp-url.mjs";

test("ZMP login QR giữ nguyên URL đăng nhập admin", () => {
  const input = "https://zalo.me/s/admin-login?zmpsk=temporary";
  assert.equal(zmpLoginUrl(input), input);
});

test("chỉ QR salon nhận context Testing Version 20", () => {
  const input = "https://zalo.me/s/2038116772828167300/?qrToken=signed";
  const result = new URL(salonTestingUrl(input));

  assert.equal(result.searchParams.get("qrToken"), "signed");
  assert.equal(result.searchParams.get("env"), "TESTING");
  assert.equal(result.searchParams.get("version"), "20");
});

test("QR salon ghi đè context cũ thay vì thêm trùng", () => {
  const input = "https://zalo.me/s/2038116772828167300/?env=PRODUCTION&version=18&qrToken=signed";
  const result = new URL(salonTestingUrl(input));

  assert.deepEqual(result.searchParams.getAll("env"), ["TESTING"]);
  assert.deepEqual(result.searchParams.getAll("version"), ["20"]);
});
