import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadMcpError() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/mcp-error.ts");
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const sandbox = { Error, exports: {}, module: { exports: {} } };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });
  return sandbox.module.exports;
}

test("adds bounded and redacted MCP stderr to process failures", () => {
  const { appendMcpStderr } = loadMcpError();
  const error = appendMcpStderr(new Error("Connection closed"), [
    "startup failed\nAuthorization: Bearer sk-or-v1-secret-value\n",
  ]);

  assert.match(error.message, /Connection closed MCP stderr: startup failed/);
  assert.doesNotMatch(error.message, /secret-value/);
  assert.match(error.message, /\[redacted\]/);
});

test("preserves an Error when stderr is empty", () => {
  const { appendMcpStderr } = loadMcpError();
  const original = new Error("Connection closed");

  assert.equal(appendMcpStderr(original, []), original);
});

test("caps MCP stderr at four KiB", () => {
  const { formatMcpStderr } = loadMcpError();
  const formatted = formatMcpStderr(["x".repeat(5000)]);

  assert.equal(formatted.length, 4096);
  assert.ok(formatted.startsWith("…"));
});
