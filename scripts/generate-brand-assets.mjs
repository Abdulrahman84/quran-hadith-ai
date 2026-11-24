#!/usr/bin/env node
// Renders every logo asset from the vector mark in src/lib/brand-mark.ts:
// - assets/*.png: sources for `@capacitor/assets` (iOS/Android icons, splashes)
// - public/brand/sanad-mark.svg and sanad-app-icon.png: web favicon and touch icon
// - src/app/icon.png: the browser tab icon Next.js serves
// Run through `npm run brand:assets` (or `npm run mobile:assets`, which then
// writes the native sizes). Needs Node 23+ to import the .ts module directly.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { markElements, markPalettes, markViewBox } from "../src/lib/brand-mark.ts";

const projectDir = process.cwd();
const assetsDir = path.join(projectDir, "assets");
const brandDir = path.join(projectDir, "public/brand");

const green = "#0B5D3E";
const greenLight = "#13754F";
const greenDeep = "#084630";
const sand = "#FBFAF5";

// Places the mark centred in a square canvas at `markWidth` px wide.
function markLayer(size, markWidth, palette) {
  const scale = markWidth / markViewBox.width;
  const markHeight = markViewBox.height * scale;
  const left = (size - markWidth) / 2;
  const top = (size - markHeight) / 2;

  return `<g transform="translate(${left} ${top}) scale(${scale}) translate(${-markViewBox.x} ${-markViewBox.y})">${markElements(palette)}</g>`;
}

// A faint brass rule inside pre-rounded tiles. Square tiles skip it because the
// platform mask would cut its corners.
function innerFrame(size, radius) {
  const inset = size * 0.045;
  return `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${radius - inset}" fill="none" stroke="#D6B264" stroke-opacity="0.22" stroke-width="${size * 0.006}"/>`;
}

// Deep-green tile with a soft light from above, the brand's app icon surface.
function greenTile(size, radius = 0) {
  return `
    <defs>
      <radialGradient id="light" cx="50%" cy="24%" r="80%">
        <stop offset="0%" stop-color="${greenLight}"/>
        <stop offset="58%" stop-color="${green}"/>
        <stop offset="100%" stop-color="${greenDeep}"/>
      </radialGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#light)"/>
    ${radius > 0 ? innerFrame(size, radius) : ""}`;
}

function svg(size, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
  );
}

async function writePng(file, size, body) {
  await sharp(svg(size, body)).png().toFile(file);
  console.log(`wrote ${path.relative(projectDir, file)}`);
}

mkdirSync(assetsDir, { recursive: true });
mkdirSync(brandDir, { recursive: true });

// iOS icon (the system applies the rounded mask) and Android legacy icon.
await writePng(path.join(assetsDir, "icon-only.png"), 1024, greenTile(1024) + markLayer(1024, 640, markPalettes.onDark));
// Android adaptive icon: launchers crop to the inner ~61%, keep the mark inside it.
await writePng(path.join(assetsDir, "icon-foreground.png"), 1024, markLayer(1024, 520, markPalettes.onDark));
await writePng(path.join(assetsDir, "icon-background.png"), 1024, greenTile(1024));
// Splash: the light app surface, and deep green when the device is in dark mode.
await writePng(
  path.join(assetsDir, "splash.png"),
  2732,
  `<rect width="2732" height="2732" fill="${sand}"/>${markLayer(2732, 440, markPalettes.onLight)}`,
);
await writePng(
  path.join(assetsDir, "splash-dark.png"),
  2732,
  `<rect width="2732" height="2732" fill="${green}"/>${markLayer(2732, 440, markPalettes.onDark)}`,
);

// Web: scalable favicon, touch icon, and the rounded tab icon.
const { x, y, width, height } = markViewBox;
writeFileSync(
  path.join(brandDir, "sanad-mark.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}">${markElements(markPalettes.onLight)}</svg>\n`,
);
console.log("wrote public/brand/sanad-mark.svg");
await writePng(path.join(brandDir, "sanad-app-icon.png"), 512, greenTile(512) + markLayer(512, 320, markPalettes.onDark));
await writePng(path.join(projectDir, "src/app/icon.png"), 512, greenTile(512, 112) + markLayer(512, 320, markPalettes.onDark));
