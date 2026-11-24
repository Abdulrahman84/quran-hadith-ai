"use client";

import { useEffect } from "react";

type RemovableListener = { remove: () => Promise<void> };

// Wires the native shell to the web UI: hides the splash once React is ready,
// maps the Android back button to history, and flags the open keyboard so the
// tab bar can step aside. Plugins load lazily so the web build never pulls them in.
export function NativeAppBridge() {
  useEffect(() => {
    const root = document.documentElement;
    const listeners: RemovableListener[] = [];
    let disposed = false;

    async function connect() {
      const [{ Capacitor }, { App }, { Keyboard }, { SplashScreen }] = await Promise.all([
        import("@capacitor/core"),
        import("@capacitor/app"),
        import("@capacitor/keyboard"),
        import("@capacitor/splash-screen"),
      ]);

      if (disposed || !Capacitor.isNativePlatform()) {
        return;
      }

      root.dataset.platform = Capacitor.getPlatform();
      void SplashScreen.hide({ fadeOutDuration: 200 });

      const registered = await Promise.all([
        App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        }),
        Keyboard.addListener("keyboardWillShow", () => {
          root.dataset.keyboard = "open";
        }),
        Keyboard.addListener("keyboardWillHide", () => {
          delete root.dataset.keyboard;
        }),
      ]);

      if (disposed) {
        registered.forEach((listener) => void listener.remove());
      } else {
        listeners.push(...registered);
      }
    }

    void connect();

    return () => {
      disposed = true;
      listeners.forEach((listener) => void listener.remove());
    };
  }, []);

  return null;
}
