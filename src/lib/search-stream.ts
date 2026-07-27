import type { RetrievalResponse } from "@/lib/retrieval/types";

export const searchStreamMediaType = "application/x-ndjson";

export type SearchProgressPhase = "starting" | "routing" | "retrieving" | "answering" | "finalizing";

export type SearchStreamEvent =
  | {
      version: 1;
      type: "progress";
      progress: number;
      phase: SearchProgressPhase;
      completed?: number;
      total?: number;
    }
  | {
      version: 1;
      type: "result";
      progress: 100;
      payload: RetrievalResponse;
      httpStatus: number;
      ok: boolean;
    }
  | {
      version: 1;
      type: "error";
      message: string;
    };

export type SearchResult = {
  payload: RetrievalResponse;
  httpStatus: number;
  ok: boolean;
};

function isSearchStreamEvent(value: unknown): value is SearchStreamEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;
  if (event.version !== 1) {
    return false;
  }

  if (event.type === "progress") {
    return (
      typeof event.progress === "number" &&
      ["starting", "routing", "retrieving", "answering", "finalizing"].includes(String(event.phase))
    );
  }

  if (event.type === "result") {
    return (
      event.progress === 100 &&
      Boolean(event.payload) &&
      typeof event.payload === "object" &&
      typeof event.httpStatus === "number" &&
      typeof event.ok === "boolean"
    );
  }

  return event.type === "error" && typeof event.message === "string";
}

function parseEvent(line: string) {
  const event = JSON.parse(line) as unknown;

  if (!isSearchStreamEvent(event)) {
    throw new Error("The search server returned an invalid progress event.");
  }

  return event;
}

export async function readSearchResponse(
  response: Response,
  onProgress: (event: Extract<SearchStreamEvent, { type: "progress" }>) => void,
): Promise<SearchResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes(searchStreamMediaType)) {
    return {
      payload: (await response.json()) as RetrievalResponse,
      httpStatus: response.status,
      ok: response.ok,
    };
  }

  if (!response.body) {
    throw new Error("The search server returned an empty progress stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = parseEvent(line);

      if (event.type === "progress") {
        onProgress(event);
      } else if (event.type === "error") {
        throw new Error(event.message);
      } else {
        return {
          payload: event.payload,
          httpStatus: event.httpStatus,
          ok: event.ok,
        };
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    const event = parseEvent(buffer);

    if (event.type === "result") {
      return {
        payload: event.payload,
        httpStatus: event.httpStatus,
        ok: event.ok,
      };
    }

    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  throw new Error("The search progress stream ended before a result was returned.");
}
