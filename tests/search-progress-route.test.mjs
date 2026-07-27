import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { readSearchResponse, searchStreamMediaType } from "../src/lib/search-stream.ts";

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("search API keeps JSON compatibility and opts into streamed progress", () => {
  const routeSource = readSource("src/app/api/search/route.ts");

  assert.match(routeSource, /acceptsProgressStream/);
  assert.match(routeSource, /return streamSearch\(request, input, startedAt\)/);
  assert.match(routeSource, /return Response\.json\(response/);
  assert.match(routeSource, /"X-Accel-Buffering": "no"/);
});

test("stream progress is phase-based and returns 100 with the result", () => {
  const routeSource = readSource("src/app/api/search/route.ts");

  assert.match(routeSource, /report\(8, "starting"\)/);
  assert.match(routeSource, /report\?\.\(14, "routing"\)/);
  assert.match(routeSource, /report\?\.\(progress, "retrieving"/);
  assert.match(routeSource, /report\?\.\(76, "answering"\)/);
  assert.match(routeSource, /report\?\.\(94, "finalizing"\)/);
  assert.match(routeSource, /type: "result",\s+progress: 100/);
  assert.doesNotMatch(routeSource, /report\(100/);
});

test("progress reader handles arbitrary chunks and split Arabic UTF-8", async () => {
  const encoder = new TextEncoder();
  const events = [
    JSON.stringify({ version: 1, type: "progress", progress: 22, phase: "retrieving" }),
    JSON.stringify({
      version: 1,
      type: "result",
      progress: 100,
      payload: { query: "بحث", warnings: [] },
      httpStatus: 200,
      ok: true,
    }),
  ].join("\n");
  const bytes = encoder.encode(`${events}\n`);
  let offset = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) {
        controller.close();
        return;
      }

      controller.enqueue(bytes.slice(offset, offset + 1));
      offset += 1;
    },
  });
  const progress = [];
  const result = await readSearchResponse(
    new Response(body, { headers: { "Content-Type": `${searchStreamMediaType}; charset=utf-8` } }),
    (event) => progress.push(event.progress),
  );

  assert.deepEqual(progress, [22]);
  assert.equal(result.payload.query, "بحث");
  assert.equal(result.ok, true);
});

test("progress reader rejects a truncated stream", async () => {
  const body = `${JSON.stringify({ version: 1, type: "progress", progress: 14, phase: "routing" })}\n`;
  const response = new Response(body, {
    headers: { "Content-Type": `${searchStreamMediaType}; charset=utf-8` },
  });

  await assert.rejects(() => readSearchResponse(response, () => {}), /ended before a result/);
});
