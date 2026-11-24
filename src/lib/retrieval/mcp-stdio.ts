import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

import { appendMcpStderr, appendStderrChunk } from "./mcp-error";

export type McpCallResult = {
  structuredContent?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
};

export type McpStdioConfig = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
};

type McpSession = {
  client: Client;
  /** Stderr written by the server while this run was active. */
  stderr: string[];
};

type StderrListener = (chunk: string) => void;

type PooledClient = {
  client: Client;
  transport: StdioClientTransport;
  recentStderr: string[];
  stderrListeners: Set<StderrListener>;
  activeRuns: number;
  closed: boolean;
};

type ClientPool = {
  entries: Map<string, Promise<PooledClient>>;
  live: Set<PooledClient>;
  exitHooksInstalled: boolean;
};

type RefCountedHandle = { ref?: () => unknown; unref?: () => unknown };

type ChildProcessHandles = RefCountedHandle & {
  stdin?: RefCountedHandle | null;
  stdout?: RefCountedHandle | null;
  stderr?: RefCountedHandle | null;
};

const POOL_KEY = Symbol.for("quran-hadith-ai.mcpClientPool");

// Kept on globalThis so Next dev hot reloads reuse running servers instead of leaking new ones.
function getPool(): ClientPool {
  const holder = globalThis as typeof globalThis & { [POOL_KEY]?: ClientPool };

  if (!holder[POOL_KEY]) {
    holder[POOL_KEY] = { entries: new Map(), live: new Set(), exitHooksInstalled: false };
  }

  return holder[POOL_KEY];
}

function poolKey(config: McpStdioConfig) {
  const env = Object.entries(config.env ?? {}).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([config.command, config.args, config.cwd ?? null, env]);
}

function childProcessOf(transport: StdioClientTransport): ChildProcessHandles | null {
  const candidate: unknown = Reflect.get(transport, "_process");
  return typeof candidate === "object" && candidate !== null ? candidate : null;
}

// Idle servers must not keep short-lived scripts alive; busy ones must keep the loop running until the reply arrives.
function setProcessRef(pooled: PooledClient, shouldRef: boolean) {
  const child = childProcessOf(pooled.transport);

  if (!child) {
    return;
  }

  for (const handle of [child, child.stdin, child.stdout, child.stderr]) {
    const toggle = shouldRef ? handle?.ref : handle?.unref;
    toggle?.call(handle);
  }
}

async function closePooledClient(pooled: PooledClient) {
  pooled.closed = true;
  getPool().live.delete(pooled);
  await pooled.client.close().catch(() => undefined);
}

export async function closeAllMcpClients() {
  const pool = getPool();
  const entries = [...pool.entries.values()];
  pool.entries.clear();

  await Promise.all(
    entries.map(async (entry) => {
      const pooled = await entry.catch(() => null);

      if (pooled) {
        await closePooledClient(pooled);
      }
    }),
  );
}

// The "exit" event only allows synchronous work, so signal the children directly.
function killPooledProcessesSync() {
  for (const pooled of getPool().live) {
    const pid = pooled.transport.pid;

    if (pid) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
}

function installExitHooks(pool: ClientPool) {
  if (pool.exitHooksInstalled) {
    return;
  }

  pool.exitHooksInstalled = true;
  process.once("beforeExit", () => {
    void closeAllMcpClients();
  });
  process.once("exit", killPooledProcessesSync);

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      void closeAllMcpClients().finally(() => {
        // Restore default signal behavior when nothing else (e.g. the Next server) handles it.
        if (process.listenerCount(signal) === 0) {
          process.kill(process.pid, signal);
        }
      });
    });
  }
}

function connectPooledClient(config: McpStdioConfig, key: string): Promise<PooledClient> {
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
  const pooled: PooledClient = {
    client,
    transport,
    recentStderr: [],
    stderrListeners: new Set(),
    activeRuns: 0,
    closed: false,
  };

  transport.stderr?.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    appendStderrChunk(pooled.recentStderr, text);
    pooled.stderrListeners.forEach((listener) => listener(text));
  });

  client.onclose = () => {
    pooled.closed = true;
    const pool = getPool();
    pool.live.delete(pooled);

    if (pool.entries.get(key) === entryPromise) {
      pool.entries.delete(key);
    }
  };

  const entryPromise = client.connect(transport).then(
    () => {
      if (!pooled.closed) {
        getPool().live.add(pooled);
      }

      setProcessRef(pooled, pooled.activeRuns > 0);
      return pooled;
    },
    async (error: unknown) => {
      await closePooledClient(pooled);
      throw appendMcpStderr(error, pooled.recentStderr);
    },
  );

  return entryPromise;
}

function acquirePooledClient(config: McpStdioConfig): Promise<PooledClient> {
  const pool = getPool();
  const key = poolKey(config);
  const existing = pool.entries.get(key);

  if (existing) {
    return existing;
  }

  installExitHooks(pool);
  const entry = connectPooledClient(config, key);
  pool.entries.set(key, entry);
  entry.catch(() => {
    if (pool.entries.get(key) === entry) {
      pool.entries.delete(key);
    }
  });

  return entry;
}

function isConnectionClosedError(error: unknown) {
  return error instanceof McpError && error.code === ErrorCode.ConnectionClosed;
}

async function runOnPooledClient<T>(pooled: PooledClient, run: (session: McpSession) => Promise<T>): Promise<T> {
  const runStderr: string[] = [];
  const listener: StderrListener = (chunk) => appendStderrChunk(runStderr, chunk);

  pooled.stderrListeners.add(listener);
  pooled.activeRuns += 1;
  setProcessRef(pooled, true);

  try {
    return await run({ client: pooled.client, stderr: runStderr });
  } finally {
    pooled.stderrListeners.delete(listener);
    pooled.activeRuns -= 1;

    if (pooled.activeRuns === 0 && !pooled.closed) {
      setProcessRef(pooled, false);
    }
  }
}

/**
 * Runs against a long-lived MCP server process shared by every caller with the same config.
 * If the process dies mid-run, the run is retried once on a freshly spawned server.
 */
export async function withStdioMcpClient<T>(config: McpStdioConfig, run: (session: McpSession) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const pooled = await acquirePooledClient(config);

    try {
      return await runOnPooledClient(pooled, run);
    } catch (error) {
      const processDied = pooled.closed || isConnectionClosedError(error);

      if (processDied && attempt === 0) {
        await closePooledClient(pooled);
        continue;
      }

      throw appendMcpStderr(error, pooled.recentStderr);
    }
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
