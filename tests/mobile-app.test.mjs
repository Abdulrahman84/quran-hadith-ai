import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function loadModule(relativePath, env = {}, fetchImpl = fetch) {
  const filename = path.join(process.cwd(), relativePath);
  const transpiled = ts.transpileModule(readSource(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, process: { env }, fetch: fetchImpl, TypeError, Error };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });
  return sandbox.module.exports;
}

test("CORS allows only the Capacitor app origins plus configured extras", () => {
  const { getAllowedOrigins, isAllowedOrigin, corsHeaders } = loadModule("src/lib/cors.ts");

  const defaults = getAllowedOrigins("");
  assert.deepEqual([...defaults], ["capacitor://localhost", "https://localhost"]);
  assert.equal(isAllowedOrigin("capacitor://localhost", defaults), true);
  assert.equal(isAllowedOrigin("https://evil.example", defaults), false);
  assert.equal(isAllowedOrigin(null, defaults), false);

  const extended = getAllowedOrigins(" https://staging.example/ , ,https://localhost");
  assert.deepEqual([...extended], ["capacitor://localhost", "https://localhost", "https://staging.example"]);

  const headers = corsHeaders("capacitor://localhost");
  assert.equal(headers["Access-Control-Allow-Origin"], "capacitor://localhost");
  assert.match(headers["Access-Control-Allow-Methods"], /POST/);
  assert.match(headers["Access-Control-Allow-Headers"], /Content-Type/);
  assert.equal(headers.Vary, "Origin");
});

test("CORS allows the custom header the search stream request sends", () => {
  const { corsHeaders } = loadModule("src/lib/cors.ts");
  const [, featuresHeader] = readSource("src/lib/search-stream.ts").match(
    /export const searchStreamFeaturesHeader = "([^"]+)"/,
  );
  const allowed = corsHeaders("capacitor://localhost")["Access-Control-Allow-Headers"]
    .split(",")
    .map((header) => header.trim().toLowerCase());

  assert.ok(allowed.includes(featuresHeader.toLowerCase()));
});

test("API URLs are same-origin on the web and absolute in the mobile bundle", () => {
  assert.equal(loadModule("src/lib/api-url.ts").apiUrl("/api/search"), "/api/search");
  assert.equal(
    loadModule("src/lib/api-url.ts", { NEXT_PUBLIC_API_BASE_URL: "https://sanaddai.com/" }).apiUrl("/api/check"),
    "https://sanaddai.com/api/check",
  );
});

test("fetchApi reports unreachable servers separately from HTTP errors", async () => {
  const offline = loadModule("src/lib/api-url.ts", {}, async () => {
    throw new TypeError("Load failed");
  });
  await assert.rejects(offline.fetchApi("/api/search", {}), (error) => error instanceof offline.ApiUnreachableError);

  const aborted = loadModule("src/lib/api-url.ts", {}, async () => {
    throw new Error("The operation was aborted.");
  });
  await assert.rejects(
    aborted.fetchApi("/api/search", {}),
    (error) => !(error instanceof aborted.ApiUnreachableError),
  );

  const httpError = { ok: false, status: 503 };
  const online = loadModule("src/lib/api-url.ts", { NEXT_PUBLIC_API_BASE_URL: "https://sanaddai.com" }, async (url) => {
    assert.equal(url, "https://sanaddai.com/api/check");
    return httpError;
  });
  assert.equal(await online.fetchApi("/api/check", {}), httpError);
});

test("Search and Check call the API through the configurable base URL", () => {
  assert.match(readSource("src/components/search/use-search-stream.ts"), /fetchApi\("\/api\/search"/);
  assert.match(readSource("src/components/check/check-panel.tsx"), /fetchApi\("\/api\/check"/);
});

test("Mobile export leaves the Node-only API routes and proxy out of the bundle", () => {
  const nextConfig = readSource("next.config.ts");
  const capacitorConfig = readSource("capacitor.config.ts");

  assert.match(nextConfig, /output: "export"/);
  assert.match(nextConfig, /pageExtensions: \["tsx"\]/);
  assert.ok(fs.existsSync(path.join(process.cwd(), "src/app/api/search/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "src/proxy.ts")));
  assert.match(capacitorConfig, /appId: "com\.sanaddai\.app"/);
  assert.match(capacitorConfig, /appName: "Sanad AI"/);
  assert.match(capacitorConfig, /webDir: "out"/);
  assert.doesNotMatch(capacitorConfig, /server:\s*\{[^}]*url/);
});

test("The logo, favicon and app icons all come from the vector mark", () => {
  const { markElements, markPalettes } = loadModule("src/lib/brand-mark.ts");
  const logo = readSource("src/components/sanad-logo.tsx");
  const layout = readSource("src/app/layout.tsx");

  for (const palette of Object.values(markPalettes)) {
    const markup = markElements(palette);
    assert.match(markup, /class="sanad-mark-head"/);
    assert.ok(markup.includes(palette.book) && markup.includes(palette.accent));
  }

  assert.match(logo, /markElements\(markPalettes\.onLight\)/);
  assert.match(logo, /سند/);
  assert.doesNotMatch(logo, /<image/);
  assert.match(layout, /\/brand\/sanad-mark\.svg/);

  for (const file of [
    "public/brand/sanad-mark.svg",
    "public/brand/sanad-app-icon.png",
    "assets/icon-only.png",
    "assets/splash.png",
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} is missing`);
  }
});
