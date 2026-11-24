export type SseParser = {
  /** Feeds decoded text; returns the data payloads of every event completed by it. */
  push: (chunk: string) => string[];
  /** Returns a final event left without a trailing blank line, if any. */
  flush: () => string[];
};

/**
 * Minimal text/event-stream parser: joins multi-line `data:` fields, ends an
 * event at a blank line, and drops comment lines (OpenRouter sends
 * `: OPENROUTER PROCESSING` as a keep-alive).
 */
export function createSseParser(): SseParser {
  let buffer = "";
  let dataLines: string[] = [];

  const takeEvent = (events: string[]) => {
    if (dataLines.length > 0) {
      events.push(dataLines.join("\n"));
      dataLines = [];
    }
  };

  const readLine = (rawLine: string, events: string[]) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (line === "") {
      takeEvent(events);
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    if (line === "data" || line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  };

  return {
    push(chunk) {
      const events: string[] = [];
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");

      while (newlineIndex >= 0) {
        readLine(buffer.slice(0, newlineIndex), events);
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }

      return events;
    },
    flush() {
      const events: string[] = [];

      if (buffer) {
        readLine(buffer, events);
        buffer = "";
      }

      takeEvent(events);
      return events;
    },
  };
}

export type ChatStreamChunk =
  | { kind: "delta"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string; code?: number }
  | { kind: "ignore" };

/** Interprets one OpenAI-compatible chat streaming payload. */
export function parseChatStreamData(data: string): ChatStreamChunk {
  if (data.trim() === "[DONE]") {
    return { kind: "done" };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(data);
  } catch {
    return { kind: "ignore" };
  }

  if (!payload || typeof payload !== "object") {
    return { kind: "ignore" };
  }

  const record = payload as {
    error?: { message?: unknown; code?: unknown };
    choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>;
  };

  if (record.error) {
    return {
      kind: "error",
      message: typeof record.error.message === "string" ? record.error.message : "The model stream reported an error.",
      ...(typeof record.error.code === "number" ? { code: record.error.code } : {}),
    };
  }

  const choice = record.choices?.[0];

  if (choice?.finish_reason === "error") {
    return { kind: "error", message: "The model stream ended with an error." };
  }

  const content = choice?.delta?.content;

  return typeof content === "string" && content.length > 0 ? { kind: "delta", text: content } : { kind: "ignore" };
}
