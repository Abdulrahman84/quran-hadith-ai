import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const command = process.env.TAFSIR_MCP_COMMAND;
const args = process.env.TAFSIR_MCP_ARGS?.trim().split(/\s+/).filter(Boolean) ?? [];

if (!command) {
  throw new Error("TAFSIR_MCP_COMMAND is required for the Tafsir MCP smoke test.");
}

const client = new Client({ name: "tafsir-image-smoke", version: "0.1.0" });
const transport = new StdioClientTransport({ command, args, env: process.env, stderr: "pipe" });
const stderr = [];

transport.stderr?.on("data", (chunk) => {
  stderr.push(chunk.toString());
});

try {
  await client.connect(transport);
  const tools = await client.listTools();

  if (!tools.tools.some((tool) => tool.name === "fetch_ayah")) {
    throw new Error("Tafsir MCP did not expose fetch_ayah.");
  }

  const result = await client.callTool({ name: "fetch_ayah", arguments: { surah: 1, ayah: 1 } });

  if (result.isError) {
    throw new Error("Tafsir MCP fetch_ayah smoke call failed.");
  }
} catch (error) {
  const details = stderr.join("").trim();

  if (details) {
    console.error(details);
  }

  throw error;
} finally {
  await client.close().catch(() => undefined);
}
