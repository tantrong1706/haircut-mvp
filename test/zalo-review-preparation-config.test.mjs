import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preparationScript = new URL(
  "../zalo-mini-app/tools/prepare-zalo-review.mjs",
  import.meta.url,
);

test("review preparation uses the canonical app domain and brand", async () => {
  const source = await readFile(preparationScript, "utf8");

  assert.match(source, /CH Haircut Salon - Xét duyệt Zalo/);
  assert.match(source, /https:\/\/app\.chhaircutsalon\.cc\/owner/);
  assert.match(source, /https:\/\/app\.chhaircutsalon\.cc\/staff/);
  assert.doesNotMatch(source, /HAIRCUT Studio - Xét duyệt Zalo/);
  assert.doesNotMatch(source, /https:\/\/haircut-c7d12\.web\.app\/(owner|staff)/);
});
