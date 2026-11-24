#!/usr/bin/env node
// Builds the source images @capacitor/assets expects in assets/ from the brand
// icon, then `npm run mobile:assets` turns them into every iOS/Android size.
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const projectDir = process.cwd();
const sourceIcon = path.join(projectDir, "public/brand/sanad-icon-gold-forward.png");
const assetsDir = path.join(projectDir, "assets");
const sand = { r: 0xfb, g: 0xfa, b: 0xf5, alpha: 1 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function compose({ file, canvas, logo, background }) {
  const resizedLogo = await sharp(sourceIcon)
    .resize(logo, logo, { fit: "contain", background: transparent, kernel: "lanczos3" })
    .toBuffer();

  await sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: resizedLogo, gravity: "center" }])
    .png()
    .toFile(path.join(assetsDir, file));
}

mkdirSync(assetsDir, { recursive: true });

// iOS app icon: opaque, logo at ~68% so it clears the rounded-corner mask.
await compose({ file: "icon-only.png", canvas: 1024, logo: 700, background: sand });
// Android adaptive icon: the launcher crops to the inner 66%, keep the logo inside it.
await compose({ file: "icon-foreground.png", canvas: 1024, logo: 560, background: transparent });
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: sand } })
  .png()
  .toFile(path.join(assetsDir, "icon-background.png"));
// Splash: small centred mark on the app background (the UI is light-only).
await compose({ file: "splash.png", canvas: 2732, logo: 512, background: sand });
await compose({ file: "splash-dark.png", canvas: 2732, logo: 512, background: sand });

console.log(`Wrote mobile asset sources to ${path.relative(projectDir, assetsDir)}/`);
