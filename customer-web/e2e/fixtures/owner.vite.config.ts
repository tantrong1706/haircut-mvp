import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  envDir: false,
  optimizeDeps: { entries: ["e2e/fixtures/owner-responsive.html"] },
  plugins: [react()],
  resolve: { alias: [{ find: "../services/operations", replacement: fileURLToPath(new URL("./owner-operations.ts", import.meta.url)) }] },
  server: { host: "127.0.0.1", port: 4176, strictPort: true },
});
