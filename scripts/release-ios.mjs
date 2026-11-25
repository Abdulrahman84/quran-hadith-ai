// Archives the iOS app and exports an App Store Connect .ipa into release/ios.
// Run `npm run mobile:build` first. Needs APPLE_TEAM_ID in the environment or
// .env.local; the team ID stays out of the repo.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const teamId = process.env.APPLE_TEAM_ID?.trim();

if (!teamId) {
  console.error("Set APPLE_TEAM_ID (your Apple Developer team ID) in .env.local or the environment.");
  process.exit(1);
}

const outputDir = resolve("release/ios");
const archivePath = resolve(outputDir, "SanadAI.xcarchive");
const exportOptionsPath = resolve(outputDir, "ExportOptions.plist");

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

writeFileSync(
  exportOptionsPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>${teamId}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <true/>
  <key>destination</key>
  <string>export</string>
</dict>
</plist>
`,
);

function run(args) {
  const result = spawnSync("xcodebuild", args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run([
  "-project",
  "ios/App/App.xcodeproj",
  "-scheme",
  "App",
  "-configuration",
  "Release",
  "-destination",
  "generic/platform=iOS",
  "-archivePath",
  archivePath,
  "-allowProvisioningUpdates",
  `DEVELOPMENT_TEAM=${teamId}`,
  "archive",
]);

run([
  "-exportArchive",
  "-archivePath",
  archivePath,
  "-exportPath",
  outputDir,
  "-exportOptionsPlist",
  exportOptionsPath,
  "-allowProvisioningUpdates",
]);

console.log(`\nExported to ${outputDir}`);
