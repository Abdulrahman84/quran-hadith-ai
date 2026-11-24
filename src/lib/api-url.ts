// Empty on the web (same-origin requests). The mobile build bakes in the
// deployed origin because the bundled UI has no API routes of its own.
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: `/api/${string}`): string {
  return `${apiBaseUrl}${path}`;
}

export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super("The Sanad API could not be reached.", { cause });
    this.name = "ApiUnreachableError";
  }
}

// Like fetch(), but a request that never got an HTTP response (offline, DNS
// failure, CORS rejection) rejects with ApiUnreachableError. Aborts pass through.
export async function fetchApi(path: `/api/${string}`, init: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiUnreachableError(error);
    }

    throw error;
  }
}
