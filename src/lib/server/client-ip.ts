// Edge-set headers come first: the proxy overwrites them, while the first
// X-Forwarded-For hop is whatever the client sent and can be spoofed.
const trustedSingleValueHeaders = ["cf-connecting-ip", "true-client-ip", "x-real-ip"];

export function getClientIp(request: Request): string {
  const configuredHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const headerNames = configuredHeader ? [configuredHeader, ...trustedSingleValueHeaders] : trustedSingleValueHeaders;

  for (const name of headerNames) {
    const value = request.headers.get(name)?.split(",")[0]?.trim();

    if (value) {
      return value;
    }
  }

  const firstHop = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return firstHop || "unknown";
}
