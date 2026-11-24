// True only in the Capacitor bundle (`npm run mobile:build` sets it at build
// time), so the web build never ships the app chrome or plugin code paths.
export const isNativeApp = process.env.NEXT_PUBLIC_NATIVE_APP === "1";
