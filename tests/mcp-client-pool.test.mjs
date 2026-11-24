import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const retrievalDir = path.join(process.cwd(), "src/lib/retrieval");
const fixtureServer = path.join(process.cwd(), "tests/fixtures/mcp-pid-server.mjs");

function loadModule(name, localModules = {}) {
  const filename = path.join(retrievalDir, `${name}.ts`);
  const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = { exports: {} };

  // The pool lives on globalThis and hooks process events, so the sandbox shares the real ones.
  vm.runInNewContext(
    transpiled,
    {
      exports: loaded.exports,
      module: loaded,
      process,
      globalThis,
      Reflect,
      Symbol,
      JSON,
      require: (specifier) => localModules[specifier] ?? nodeRequire(specifier),
    },
    { filename },
  );

  return loaded.exports;
}

const mcpError = loadModule("mcp-error");
const { withStdioMcpClient, closeAllMcpClients, getMcpPayload } = loadModule("mcp-stdio", { "./mcp-error": mcpError });
const config = { command: process.execPath, args: [fixtureServer] };

async function serverPid(client) {
  return getMcpPayload(await client.callTool({ name: "whoami", arguments: {} })).pid;
}

test.after(async () => {
  await closeAllMcpClients();
});

test("reuses one server process across calls and shares a concurrent connect", async () => {
  const pids = await Promise.all([
    withStdioMcpClient(config, ({ client }) => serverPid(client)),
    withStdioMcpClient(config, ({ client }) => serverPid(client)),
  ]);
  const later = await withStdioMcpClient(config, ({ client }) => serverPid(client));

  assert.equal(pids[0], pids[1]);
  assert.equal(later, pids[0]);
});

test("collects stderr written during a run", async () => {
  const stderr = await withStdioMcpClient(config, async (session) => {
    await serverPid(session.client);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return session.stderr.join("");
  });

  assert.match(stderr, /whoami from \d+/);
});

test("respawns the server when the process dies and retries the run once", async () => {
  const before = await withStdioMcpClient(config, ({ client }) => serverPid(client));

  await withStdioMcpClient(config, ({ client }) => client.callTool({ name: "crash", arguments: {} }));
  await new Promise((resolve) => setTimeout(resolve, 200));

  const after = await withStdioMcpClient(config, ({ client }) => serverPid(client));

  assert.notEqual(after, before);
});

test("retries a run whose server dies mid-call", async () => {
  let attempts = 0;
  const pid = await withStdioMcpClient(config, async ({ client }) => {
    attempts += 1;

    if (attempts === 1) {
      await client.callTool({ name: "crash", arguments: {} });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return serverPid(client);
  });

  assert.equal(attempts, 2);
  assert.equal(typeof pid, "number");
});

test("surfaces stderr when the server cannot start", async () => {
  await assert.rejects(
    withStdioMcpClient({ command: process.execPath, args: ["-e", "console.error('boot failure'); process.exit(3)"] }, async () => "unreachable"),
    /boot failure/,
  );
});
