// Origins the Capacitor webviews load the bundled UI from: iOS uses the
// capacitor:// scheme, Android serves it from https://localhost.
const nativeAppOrigins = ["capacitor://localhost", "https://localhost"];

const allowedMethods = "GET, POST, OPTIONS";
// Every request header the app sends must be listed, or the webview's
// preflight fails. X-Search-Stream-Features is searchStreamFeaturesHeader in
// src/lib/search-stream.ts (asks for streamed answer drafts).
const allowedHeaders = "Accept, Content-Type, X-Search-Stream-Features";
const preflightMaxAgeSeconds = "86400";

export function getAllowedOrigins(extraOrigins = process.env.CORS_ALLOWED_ORIGINS ?? ""): string[] {
  const configured = extraOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set([...nativeAppOrigins, ...configured])];
}

export function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): origin is string {
  return origin !== null && allowedOrigins.includes(origin);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Max-Age": preflightMaxAgeSeconds,
    Vary: "Origin",
  };
}
