import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import { z } from "zod";

import { getViteBuildOutDir } from "./src/config/buildOutput";

const productionEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_ZALO_MINI_APP_ID: z.literal("2038116772828167300"),
  VITE_FUNCTION_WRITE_MODE: z.literal("required"),
  VITE_APP_ENV: z.literal("production"),
  VITE_ZALO_PREVIEW: z.literal("false").optional(),
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (mode === "production") {
    const result = productionEnvSchema.safeParse(env);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Biến môi trường production chưa hợp lệ: ${fields}`);
    }
  }

  const hasSentryUpload = Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);
  const outDir = getViteBuildOutDir(mode);

  return {
    base: "./",
    plugins: [
      react(),
      zaloMiniApp(),
      ...(hasSentryUpload
        ? [
            sentryVitePlugin({
              authToken: env.SENTRY_AUTH_TOKEN,
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              telemetry: false,
              sourcemaps: {
                assets: `./${outDir}/assets/**`,
                filesToDeleteAfterUpload: [`./${outDir}/**/*.map`],
              },
            }),
          ]
        : []),
    ],
    build: {
      outDir,
      manifest: true,
      sourcemap: hasSentryUpload ? "hidden" : false,
      modulePreload: {
        polyfill: false,
      },
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name].[hash].module.js",
          chunkFileNames: "assets/[name].[hash].module.js",
          assetFileNames: "assets/[name].[hash][extname]",
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
  };
});
