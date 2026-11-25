// The Sanad mark as plain SVG markup, so the header logo, favicon, app icons,
// splash screens and loader all draw from one source.
// scripts/generate-brand-assets.mjs imports this file directly with Node.
//
// A friendly robot reading an open book that rests on a rahl (رحل), the
// folding stand used for the Quran. Flat colour on a 64-unit grid. The book
// sits in front of the robot's chin and the stand, separated by a transparent
// gap (an SVG mask), so the mark works on any background.

export type MarkPalette = {
  /** The robot's head shell. */
  shell: string;
  /** The face panel inside the shell. */
  screen: string;
  eye: string;
  /** Small highlight in each eye. */
  shine: string;
  /** Antenna, ear bolts and the rahl. */
  accent: string;
  /** The book's binding edge and gutter. */
  book: string;
  pages: string;
  /** The faint text lines on the pages. */
  trim: string;
};

export const markViewBox = { x: 7, y: 7, width: 50, height: 54 } as const;

export const markPalettes = {
  // Sand and paper backgrounds (the site, light splash screen).
  onLight: {
    shell: "#0B5D3E",
    screen: "#FBFAF5",
    eye: "#0B5D3E",
    shine: "#FBFAF5",
    accent: "#C69A4B",
    book: "#0B5D3E",
    pages: "#FBFAF5",
    trim: "#C69A4B",
  },
  // The deep-green app icon tile and dark splash screen. The face matches the
  // light version (dark eyes, light highlight): pale eyes with a dark dot read
  // as pupils glancing up and to the side.
  onDark: {
    shell: "#FBFAF5",
    screen: "#FBFAF5",
    eye: "#0B5D3E",
    shine: "#FBFAF5",
    accent: "#D6B264",
    book: "#D6B264",
    pages: "#FBFAF5",
    trim: "#C69A4B",
  },
} satisfies Record<string, MarkPalette>;

// The open book: two pages curving up from the gutter.
const pages =
  "M10 41.5C17 38.5 26 39 32 43.6C38 39 47 38.5 54 41.5L52.6 47.4C46 45 38 45.4 32 49.6C26 45.4 18 45 11.4 47.4Z";
const binding = "M10 41.5L11.4 47.4C18 45 26 45.4 32 49.6C38 45.4 46 45 52.6 47.4L54 41.5";
const lines = "M14.5 43.2C19.5 42 25 42.6 29 44.6M35 44.6C39 42.6 44.5 42 49.5 43.2";
const rahl = "M19 59L44.5 44M45 59L19.5 44";
const gap = 2.6;

// Head geometry, shared by the full mark and the head-only favicon.
function headElements(palette: MarkPalette, cx: number, cy: number, w: number) {
  const k = w / 25;
  const h = 21 * k;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const radius = h * 0.42;
  const inset = 3.2 * k;
  const eyeY = cy - 0.6 * k;
  const smileY = eyeY + 3.6 * k;
  const n = (value: number) => Number(value.toFixed(2));
  const eyes = [-1, 1]
    .map((side) => {
      const ex = cx + side * w * 0.19;
      return (
        `<circle class="sanad-mark-eye" cx="${n(ex)}" cy="${n(eyeY)}" r="${n(2.7 * k)}" fill="${palette.eye}"/>` +
        `<circle cx="${n(ex - 0.7 * k)}" cy="${n(eyeY - 0.8 * k)}" r="${n(0.7 * k)}" fill="${palette.shine}"/>`
      );
    })
    .join("");
  const ears = [-1, 1]
    .map(
      (side) =>
        `<rect x="${n(side < 0 ? x - 2.6 * k : x + w - 0.6 * k)}" y="${n(cy - 3.4 * k)}" width="${n(3.2 * k)}" height="${n(6.8 * k)}" rx="${n(1.6 * k)}" fill="${palette.accent}"/>`,
    )
    .join("");

  return [
    `<g class="sanad-mark-head">`,
    `<path d="M${cx} ${n(y + 1)}V${n(y - 4.2 * k)}" stroke="${palette.accent}" stroke-width="${n(2.2 * k)}" stroke-linecap="round"/>`,
    `<circle class="sanad-mark-signal" cx="${cx}" cy="${n(y - 6.2 * k)}" r="${n(2.7 * k)}" fill="${palette.accent}"/>`,
    ears,
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(radius)}" fill="${palette.shell}"/>`,
    `<rect x="${n(x + inset)}" y="${n(y + inset)}" width="${n(w - inset * 2)}" height="${n(h - inset * 2)}" rx="${n(radius - inset * 0.8)}" fill="${palette.screen}"/>`,
    eyes,
    `<path d="M${n(cx - 2.2 * k)} ${n(smileY)}Q${cx} ${n(smileY + 1.9 * k)} ${n(cx + 2.2 * k)} ${n(smileY)}" fill="none" stroke="${palette.eye}" stroke-width="${n(1.4 * k)}" stroke-linecap="round"/>`,
    `</g>`,
  ].join("");
}

export function markElements(palette: MarkPalette): string {
  // The robot's chin dips behind the book, which ties the two together.
  // Everything behind the book is masked by its outline plus a small gap.
  return [
    `<defs><mask id="sanad-mark-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">`,
    `<rect width="64" height="64" fill="#fff"/>`,
    `<path d="${pages}" fill="#000" stroke="#000" stroke-width="${gap * 2}" stroke-linejoin="round"/>`,
    `</mask></defs>`,
    `<g mask="url(#sanad-mark-gap)">`,
    `<path d="${rahl}" stroke="${palette.accent}" stroke-width="3.8" stroke-linecap="round"/>`,
    headElements(palette, 32, 29, 25),
    `</g>`,
    `<path d="${pages}" fill="${palette.pages}"/>`,
    `<path d="${binding}" fill="none" stroke="${palette.book}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path d="M32 43.6V49.6" stroke="${palette.book}" stroke-width="1.4"/>`,
    `<path d="${lines}" fill="none" stroke="${palette.trim}" stroke-width="1" stroke-linecap="round"/>`,
  ].join("");
}

// The favicon at 16-32px: the head alone, which stays readable where the
// book and stand would blur.
export const faviconViewBox = { x: 4, y: 2, width: 56, height: 56 } as const;

export function faviconElements(palette: MarkPalette): string {
  return headElements(palette, 32, 38, 46);
}

export function markViewBoxAttribute(): string {
  const { x, y, width, height } = markViewBox;
  return `${x} ${y} ${width} ${height}`;
}
