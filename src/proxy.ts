import { NextResponse, type NextRequest } from "next/server";

import { corsHeaders, getAllowedOrigins, isAllowedOrigin } from "@/lib/cors";

const allowedOrigins = getAllowedOrigins();

// The mobile apps bundle the UI and call this API cross-origin, so /api/*
// answers CORS preflights and tags responses for the app origins only.
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = isAllowedOrigin(origin, allowedOrigins);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: allowed ? 204 : 403,
      headers: allowed ? corsHeaders(origin) : { Vary: "Origin" },
    });
  }

  const response = NextResponse.next();

  if (allowed) {
    for (const [header, value] of Object.entries(corsHeaders(origin))) {
      response.headers.set(header, value);
    }
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
