import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "vn.haircut.manager",
  appName: "HAIRCUT Manager",
  webDir: "dist",
  backgroundColor: "#10231d",
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
