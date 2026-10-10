import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(path.join(root, name), 'utf8');

test('customer Web no longer installs Mini App SDK or build plugin', () => {
  const pkg = JSON.parse(read('customer-web/package.json'));
  const lock = JSON.parse(read('customer-web/package-lock.json'));
  for (const name of ['zmp-sdk', 'zmp-vite-plugin']) {
    assert.equal(pkg.dependencies?.[name], undefined);
    assert.equal(pkg.devDependencies?.[name], undefined);
    assert.equal(lock.packages[`node_modules/${name}`], undefined);
  }
});

test('customer production source cannot switch back to Zalo identity or callables', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  const forbidden = /zmp-sdk|isZaloMiniAppRuntime|VITE_ZALO_PREVIEW|VITE_ZALO_MINI_APP_ID|["']\w+FromZalo["']/;
  for (const file of walk(path.join(root, 'customer-web/src'))) {
    if (!/\.(?:ts|tsx)$/.test(file) || /\.test\./.test(file)) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), forbidden, path.relative(root, file));
  }
});

test('retired deployment/review tools are absent; Firebase/shared modules remain', () => {
  for (const name of [
    'deploy/botkeep/server.mjs', 'scripts/package-botkeep-web.mjs',
    'customer-web/app-config.json', 'customer-web/tools/zmp-qr-login.mjs',
    'customer-web/tools/zmp-url.mjs', 'customer-web/scripts/sync-zmp-config.mjs',
    'customer-web/src/pages/ScanEntryPage.tsx', 'customer-web/src/services/zalo.ts',
    'customer-web/src/services/sessionStore.ts', 'customer-web/src/services/runtime.ts',
  ]) assert.equal(existsSync(path.join(root, name)), false, name);
  for (const name of [
    'firebase/functions/src/index.ts', 'firebase/firestore.rules',
    'customer-web/src/services/customerWebAuth.ts', 'customer-web/src/services/webCustomerApi.ts',
    'customer-web/src/services/operations.ts', 'packages/client-domain/types.ts',
  ]) assert.equal(existsSync(path.join(root, name)), true, name);
});
