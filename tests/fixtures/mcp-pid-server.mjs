import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "pid-fixture", version: "0.0.0" });

server.registerTool("whoami", { description: "Returns this server's pid." }, async () => {
  process.stderr.write(`whoami from ${process.pid}\n`);
  return { content: [{ type: "text", text: JSON.stringify({ pid: process.pid }) }] };
});

server.registerTool("crash", { description: "Exits the server process." }, async () => {
  process.stderr.write("crashing on purpose\n");
  setTimeout(() => process.exit(1), 10);
  return { content: [{ type: "text", text: "bye" }] };
});

await server.connect(new StdioServerTransport());
