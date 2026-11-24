import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const sandColor = "#fbfaf5";

const config: CapacitorConfig = {
  appId: "ai.sanad.app",
  appName: "Sanad AI",
  // Static UI export from `npm run mobile:build` (MOBILE_EXPORT=1 next build).
  webDir: "out",
  backgroundColor: sandColor,
  ios: {
    // The page pads itself with env(safe-area-inset-*), so the webview must not
    // add its own scroll-view insets on top.
    contentInset: "never",
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: "native",
      // Dark status bar icons on the light sand background.
      style: "LIGHT",
    },
    SplashScreen: {
      // Fallback only: the app hides the splash as soon as React has mounted.
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: sandColor,
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      // Shrink the webview above the keyboard so the question box stays visible.
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
