import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: "../../zalo-mini-app",
  server: { port: 5175 },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) {
            return "firebase-auth";
          }
          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) {
            return "firebase-firestore";
          }
          if (id.includes("@firebase/functions") || id.includes("firebase/functions")) {
            return "firebase-functions";
          }
          if (id.includes("@firebase") || id.includes("firebase")) return "firebase-core";
          if (id.includes("react-dom")) return "react-dom";
          if (id.includes("react")) return "react";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
});
