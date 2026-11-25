// Archives the iOS app and exports an App Store Connect .ipa into release/ios.
// Run `npm run mobile:build` first. Needs APPLE_TEAM_ID in the environment or
// .env.local; the team ID stays out of the repo.
//
// Signing uses the Apple account signed in to Xcode. Without one, set
// ASC_KEY_ID and ASC_ISSUER_ID (an App Store Connect API key, read from
// ~/.appstoreconnect/private_keys/AuthKey_<id>.p8 unless ASC_KEY_PATH is set).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const teamId = process.env.APPLE_TEAM_ID?.trim();

if (!teamId) {
  console.error("Set APPLE_TEAM_ID (your Apple Developer team ID) in .env.local or the environment.");
  process.exit(1);
}

const apiKeyId = process.env.ASC_KEY_ID?.trim();
const apiIssuerId = process.env.ASC_ISSUER_ID?.trim();
const apiKeyPath =
  process.env.ASC_KEY_PATH?.trim() || resolve(homedir(), `.appstoreconnect/private_keys/AuthKey_${apiKeyId}.p8`);

const apiKeyArgs =
  apiKeyId && apiIssuerId
    ? [
        "-authenticationKeyPath",
        apiKeyPath,
        "-authenticationKeyID",
        apiKeyId,
        "-authenticationKeyIssuerID",
        apiIssuerId,
      ]
    : [];

// Automatic signing archives with a development profile, which Apple only
// issues to teams with a registered device. IOS_PROFILE_NAME names an installed
// App Store profile instead: the archive is left unsigned and the export signs
// it with that profile and the team's Apple Distribution certificate.
const profileName = process.env.IOS_PROFILE_NAME?.trim();
const bundleId = readFileSync("capacitor.config.ts", "utf8").match(/appId: "([^"]+)"/)?.[1];

const signingOptions = profileName
  ? `<key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${bundleId}</key>
    <string>${profileName}</string>
  </dict>`
  : `<key>signingStyle</key>
  <string>automatic</string>`;

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
  ${signingOptions}
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
  ...apiKeyArgs,
  `DEVELOPMENT_TEAM=${teamId}`,
  ...(profileName ? ["CODE_SIGNING_ALLOWED=NO"] : []),
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
  ...apiKeyArgs,
]);

console.log(`\nExported to ${outputDir}`);
