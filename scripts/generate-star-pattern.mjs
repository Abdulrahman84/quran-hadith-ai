// Writes public/patterns/star-and-cross.svg: one repeating tile of the
// star-and-cross (نجمة وصليب) pattern used faintly behind the header and hero.
//
// Each star is a khatam: two squares rotated 45° apart, drawn as interlaced
// strands (a gold outline with a sand core). Around each star the strands
// alternate over and under. Small crosses sit between four stars.
//
// Run: node scripts/generate-star-pattern.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gold = "#B8893A";
const sand = "#f6f1e7";
const tile = 64; // pattern period in CSS pixels at background-size 64px
const radius = (tile / 2) * 0.94; // star tip radius; neighbouring tips nearly touch
const core = 3.2; // sand core width of a strand
const edge = 0.75; // gold outline on each side of the core
const strand = core + edge * 2;

const f = (n) => Number(n.toFixed(2));

function square(cx, cy, startDeg) {
  return Array.from({ length: 4 }, (_, i) => {
    const a = ((startDeg + i * 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  });
}

function pathOf(points) {
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
}

function intersect([x1, y1], [x2, y2], [x3, y3], [x4, y4]) {
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [x1 + t * (x2 - x1), y1 + t * (y2 - y1)] : null;
}

const strandOf = (d) =>
  `<path d="${d}" stroke="${gold}" stroke-width="${f(strand)}"/><path d="${d}" stroke="${sand}" stroke-width="${core}"/>`;

const body = [];

// Stars on the tile corners and their neighbours, so every edge wraps cleanly.
for (let gx = -1; gx <= 2; gx += 1) {
  for (let gy = -1; gy <= 2; gy += 1) {
    const [cx, cy] = [gx * tile, gy * tile];
    const upright = square(cx, cy, 45);
    const turned = square(cx, cy, 0);
    const uprightPath = pathOf(upright);

    body.push(strandOf(uprightPath), strandOf(pathOf(turned)));

    // The turned square was drawn last, so it lies on top at every crossing.
    // At every other crossing, lay a short piece of the upright strand back on
    // top. The piece follows the upright edge exactly and ends past the other
    // strand, so its ends merge into the strand already drawn (no clip seams).
    const crossings = [];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const point = intersect(upright[i], upright[(i + 1) % 4], turned[j], turned[(j + 1) % 4]);
        if (point) crossings.push({ point, from: upright[i], to: upright[(i + 1) % 4] });
      }
    }
    const angle = ({ point: [x, y] }) => Math.atan2(y - cy, x - cx);
    crossings.sort((a, b) => angle(a) - angle(b));

    const reach = strand * 1.2;
    for (const { point: [x, y], from, to } of crossings.filter((_, index) => index % 2 === 0)) {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const [ux, uy] = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
      body.push(strandOf(`M${f(x - ux * reach)} ${f(y - uy * reach)}L${f(x + ux * reach)} ${f(y + uy * reach)}`));
    }
    body.push(`<circle cx="${cx}" cy="${cy}" r="${f(tile * 0.045)}" stroke="${gold}" stroke-width="${edge}"/>`);
  }
}

// A small cross (صليب) in the space between four stars, at the tile centre.
for (const [cx, cy] of [[tile / 2, tile / 2]]) {
  const arm = tile * 0.11;
  const half = tile * 0.035;
  const d =
    `M${f(cx - half)} ${f(cy - arm)}H${f(cx + half)}V${f(cy - half)}H${f(cx + arm)}V${f(cy + half)}` +
    `H${f(cx + half)}V${f(cy + arm)}H${f(cx - half)}V${f(cy + half)}H${f(cx - arm)}V${f(cy - half)}H${f(cx - half)}Z`;
  body.push(`<path d="${d}" stroke="${gold}" stroke-width="${edge}"/>`);
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">` +
  `<rect width="${tile}" height="${tile}" fill="${sand}"/>` +
  `<g fill="none" stroke-linejoin="miter">${body.join("")}</g></svg>\n`;

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(projectDir, "public/patterns/star-and-cross.svg");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, svg);
console.log(`Wrote ${path.relative(projectDir, output)} (${svg.length} bytes)`);
