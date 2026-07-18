import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "vn.haircut.manager",
  appName: "HAIRCUT Manager",
  webDir: "dist",
  backgroundColor: "#10231d",
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/app-check": {
            symlink: true,
          },
        },
      },
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#10231d",
      showSpinner: false,
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
