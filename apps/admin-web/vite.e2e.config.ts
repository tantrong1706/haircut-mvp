import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./e2e/", import.meta.url)),
  plugins: [react()],
  resolve: { alias: [
    { find: /.*\/services\/adminApi$/, replacement: fileURLToPath(new URL("./e2e/adminApi.fixture.ts", import.meta.url)) },
    { find: /.*\/services\/firebase$/, replacement: fileURLToPath(new URL("./e2e/firebase.fixture.ts", import.meta.url)) },
    { find: "firebase/auth", replacement: fileURLToPath(new URL("./e2e/auth.fixture.ts", import.meta.url)) },
  ] },
  build: { outDir: "../www-test", emptyOutDir: true, sourcemap: false },
});
