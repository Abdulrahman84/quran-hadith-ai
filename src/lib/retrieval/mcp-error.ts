const MAX_STDERR_LENGTH = 4096;

function redactSecrets(value: string) {
  return value
    .replace(/\bsk-or-v1-[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/((?:authorization|api[_-]?key|access[_-]?token)\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/gi, "$1[redacted]");
}

export function formatMcpStderr(chunks: string[], maximumLength = MAX_STDERR_LENGTH) {
  const normalized = redactSecrets(chunks.join("")).replace(/\s+/g, " ").trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return `…${normalized.slice(-(maximumLength - 1))}`;
}

export function appendMcpStderr(error: unknown, chunks: string[]) {
  const details = formatMcpStderr(chunks);

  if (!details && error instanceof Error) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown MCP process error.";
  return new Error(details ? `${message} MCP stderr: ${details}` : message, { cause: error });
}
