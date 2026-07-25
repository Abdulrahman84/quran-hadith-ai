import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "public/brand/sanad-logo.png");
const outputDir = path.join(root, "public/logo-refinement-lab/variants");

const palettes = [
  { file: "01-original-clean.png", blue: "#00345c", gold: "#f7a817", red: "#d83545" },
  { file: "02-syrian-civic.png", blue: "#0b5d3e", gold: "#c69a4b", red: "#c63b45" },
  { file: "03-deep-green.png", blue: "#06462f", gold: "#d6b264", red: "#c63b45" },
  { file: "04-gold-forward.png", blue: "#0b5d3e", gold: "#d5a93f", red: "#c63b45" },
  { file: "05-civic-ink.png", blue: "#171a19", gold: "#c69a4b", red: "#c63b45" },
  { file: "06-forest-antique.png", blue: "#14543d", gold: "#b88935", red: "#b93640" },
];

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function distance([r, g, b], [targetR, targetG, targetB]) {
  return ((r - targetR) ** 2) + ((g - targetG) ** 2) + ((b - targetB) ** 2);
}

const sourceColors = {
  blue: [0, 52, 92],
  gold: [247, 168, 23],
  red: [216, 53, 69],
};

const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
await fs.mkdir(outputDir, { recursive: true });

for (const palette of palettes) {
  const output = Buffer.from(data);
  const targetColors = {
    blue: rgb(palette.blue),
    gold: rgb(palette.gold),
    red: rgb(palette.red),
  };

  for (let index = 0; index < output.length; index += 4) {
    const pixelIndex = index / 4;
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);

    if (x >= 775 && y < 180) {
      output[index + 3] = 0;
      continue;
    }

    if (output[index + 3] === 0) {
      continue;
    }

    const pixel = [output[index], output[index + 1], output[index + 2]];
    const group = Object.entries(sourceColors).sort(([, first], [, second]) => (
      distance(pixel, first) - distance(pixel, second)
    ))[0][0];
    const [red, green, blue] = targetColors[group];

    output[index] = red;
    output[index + 1] = green;
    output[index + 2] = blue;
  }

  await sharp(output, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png().toFile(path.join(outputDir, palette.file));
}

const selectedLogoPath = path.join(outputDir, "04-gold-forward.png");
const brandDir = path.join(root, "public/brand");

await fs.copyFile(selectedLogoPath, path.join(brandDir, "sanad-logo-gold-forward.png"));
await sharp(selectedLogoPath)
  .extract({ left: 0, top: 0, width: 330, height: 251 })
  .resize(512, 512, {
    fit: "contain",
    background: { r: 251, g: 250, b: 245, alpha: 0 },
  })
  .png()
  .toFile(path.join(brandDir, "sanad-icon-gold-forward.png"));
