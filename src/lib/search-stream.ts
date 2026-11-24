import type { RetrievalResponse } from "@/lib/retrieval/types";

export const searchStreamMediaType = "application/x-ndjson";

/** Request header a client sends to receive answer_delta / answer_reset events. */
export const searchStreamFeaturesHeader = "X-Search-Stream-Features";
export const answerDraftStreamFeature = "answer-draft";

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
    }
  | {
      version: 1;
      type: "answer_delta";
      text: string;
    }
  | {
      version: 1;
      type: "answer_reset";
    };

export type AnswerDraftStreamEvent = Extract<SearchStreamEvent, { type: "answer_delta" | "answer_reset" }>;

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

  if (event.type === "answer_delta") {
    return typeof event.text === "string";
  }

  if (event.type === "answer_reset") {
    return true;
  }

  return event.type === "error" && typeof event.message === "string";
}

const knownEventTypes = new Set(["progress", "result", "error", "answer_delta", "answer_reset"]);

// Returns null for event types this client does not know, so newer servers stay compatible.
function parseEvent(line: string): SearchStreamEvent | null {
  const event = JSON.parse(line) as unknown;

  if (
    event
    && typeof event === "object"
    && (event as { version?: unknown }).version === 1
    && !knownEventTypes.has(String((event as { type?: unknown }).type))
  ) {
    return null;
  }

  if (!isSearchStreamEvent(event)) {
    throw new Error("The search server returned an invalid progress event.");
  }

  return event;
}

export function clientAcceptsAnswerDraft(request: Request) {
  return (request.headers.get(searchStreamFeaturesHeader) ?? "")
    .split(",")
    .some((feature) => feature.trim().toLowerCase() === answerDraftStreamFeature);
}

type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const defaultTimers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Batches draft deltas so a fast model does not send one stream line per token. */
export function createAnswerDraftCoalescer(
  send: (event: AnswerDraftStreamEvent) => void,
  intervalMs = 50,
  timers: Timers = defaultTimers,
) {
  let pendingText = "";
  let timer: unknown = null;

  const flush = () => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }

    if (pendingText) {
      send({ version: 1, type: "answer_delta", text: pendingText });
      pendingText = "";
    }
  };

  return {
    delta(text: string) {
      pendingText += text;

      if (timer === null) {
        timer = timers.setTimeout(flush, intervalMs);
      }
    },
    reset() {
      pendingText = "";
      flush();
      send({ version: 1, type: "answer_reset" });
    },
    flush,
  };
}

export async function readSearchResponse(
  response: Response,
  onProgress: (event: Extract<SearchStreamEvent, { type: "progress" }>) => void,
  onAnswerDraft?: (event: AnswerDraftStreamEvent) => void,
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

      if (!event) {
        continue;
      }

      if (event.type === "progress") {
        onProgress(event);
      } else if (event.type === "answer_delta" || event.type === "answer_reset") {
        onAnswerDraft?.(event);
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

    if (event?.type === "result") {
      return {
        payload: event.payload,
        httpStatus: event.httpStatus,
        ok: event.ok,
      };
    }

    if (event?.type === "error") {
      throw new Error(event.message);
    }
  }

  throw new Error("The search progress stream ended before a result was returned.");
}
