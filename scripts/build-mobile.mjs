#!/usr/bin/env node
// Builds the static UI bundle for the Capacitor apps into out/.
//
// The search and check API routes need Node, the MCP servers and server-side
// OpenRouter keys, so they stay on the deployed web app. The bundle calls them
// over HTTPS at NEXT_PUBLIC_API_BASE_URL. No server secrets go into the app.
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const defaultApiBaseUrl = "https://sanaddai.com";
const projectDir = process.cwd();

nextEnv.loadEnvConfig(projectDir, false);

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, "");

if (!/^https:\/\//.test(apiBaseUrl) && !process.env.ALLOW_INSECURE_API_BASE_URL) {
  console.error(
    `NEXT_PUBLIC_API_BASE_URL must use https:// (got ${apiBaseUrl}). ` +
      "Set ALLOW_INSECURE_API_BASE_URL=1 to point a local build at an http dev server.",
  );
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set. Add it to .env.local or the environment (see .env.example).");
  process.exit(1);
}

const outDir = path.join(projectDir, "out");
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`Building the mobile UI bundle against ${apiBaseUrl}`);

const result = spawnSync("npx", ["next", "build"], {
  cwd: projectDir,
  stdio: "inherit",
  env: {
    ...process.env,
    MOBILE_EXPORT: "1",
    NEXT_PUBLIC_NATIVE_APP: "1",
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
  },
});

process.exit(result.status ?? 1);
