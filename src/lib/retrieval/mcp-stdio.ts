import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpCallResult = {
  structuredContent?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
};

type McpStdioConfig = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
};

type McpSession = {
  client: Client;
  stderr: string[];
};

export async function withStdioMcpClient<T>(config: McpStdioConfig, run: (session: McpSession) => Promise<T>): Promise<T> {
  const client = new Client({ name: "quran-hadith-ai", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    cwd: config.cwd,
    env: {
      ...getDefaultEnvironment(),
      ...config.env,
    },
    stderr: "pipe",
  });
  const stderr: string[] = [];

  transport.stderr?.on("data", (chunk: Buffer | string) => {
    stderr.push(chunk.toString());
  });

  try {
    await client.connect(transport);
    return await run({ client, stderr });
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function getMcpPayload(result: McpCallResult): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = result.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text;

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
