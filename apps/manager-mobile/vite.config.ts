import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const managerDependency = (packageName: string) =>
  fileURLToPath(new URL(`./node_modules/${packageName}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@haircut/contracts": managerDependency("@haircut/contracts"),
      "@sentry/react": managerDependency("@sentry/react"),
      firebase: managerDependency("firebase"),
      "lucide-react": managerDependency("lucide-react"),
      qrcode: managerDependency("qrcode"),
      react: managerDependency("react"),
      "react-dom": managerDependency("react-dom"),
    },
    dedupe: ["react", "react-dom", "firebase"],
  },
  server: { port: 5176, fs: { allow: ["../.."] } },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("html5-qrcode")) return "barcode-web";
          if (
            id.includes("@capacitor/") ||
            id.includes("@capacitor-firebase/") ||
            id.includes("@aparajita/")
          )
            return "capacitor-native";
          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) return "firebase-auth";
          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore"))
            return "firebase-firestore";
          if (id.includes("@firebase/storage") || id.includes("firebase/storage"))
            return "firebase-storage";
          if (id.includes("@firebase/functions") || id.includes("firebase/functions"))
            return "firebase-functions";
          if (id.includes("@firebase/app-check") || id.includes("firebase/app-check"))
            return "firebase-app-check";
          if (
            id.includes("@firebase/analytics") ||
            id.includes("firebase/analytics") ||
            id.includes("@firebase/performance") ||
            id.includes("firebase/performance")
          )
            return "firebase-monitoring";
          if (id.includes("@firebase") || id.includes("firebase/")) return "firebase-core";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("qrcode")) return "qrcode";
          if (id.includes("@sentry")) return "sentry";
          if (id.includes("react-dom") || id.includes("scheduler")) return "react-dom";
          if (id.includes("react")) return "react";
          return "vendor";
        },
      },
    },
  },
});
