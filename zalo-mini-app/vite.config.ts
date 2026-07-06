import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("react-dom") || id.includes("scheduler")) {
            return "vendor-react-dom";
          }
          if (id.includes("react")) {
            return "vendor-react";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("qrcode")) {
            return "vendor-qrcode";
          }
          if (id.includes("zmp-sdk")) {
            return "vendor-zalo";
          }
          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) {
            return "firebase-auth";
          }
          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) {
            return "firebase-firestore";
          }
          if (id.includes("@firebase/storage") || id.includes("firebase/storage")) {
            return "firebase-storage";
          }
          if (id.includes("@firebase/functions") || id.includes("firebase/functions")) {
            return "firebase-functions";
          }
          if (
            id.includes("@firebase/analytics") ||
            id.includes("@firebase/performance") ||
            id.includes("firebase/analytics") ||
            id.includes("firebase/performance")
          ) {
            return "firebase-monitoring";
          }
          if (id.includes("@firebase") || id.includes("firebase/")) {
            return "firebase-core";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
