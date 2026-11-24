import type { NextConfig } from "next";

// MOBILE_EXPORT=1 (set by `npm run mobile:build`) produces the static UI bundle
// for the Capacitor apps in out/. Only .tsx files count as app entries there,
// so the Node-only API route handlers and proxy (.ts) are left out of the
// export; the bundled UI calls the deployed API instead.
const isMobileExport = process.env.MOBILE_EXPORT === "1";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(isMobileExport
    ? {
        output: "export",
        pageExtensions: ["tsx"],
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
