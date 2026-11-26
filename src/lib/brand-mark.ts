// The Sanad mark as plain SVG markup, so the header logo, favicon, app icons
// and splash screens all draw from one source.
// scripts/generate-brand-assets.mjs imports this file directly with Node.
//
// An open book on a rahl (رحل), the folding stand used for the Quran, under a
// seal with a check: the text, verified from its source. Flat colour on a
// 64-unit grid. The book sits in front of the stand, separated by a
// transparent gap (an SVG mask), so the mark works on any background.

export type MarkPalette = {
  /** The seal's disc. */
  seal: string;
  /** The check inside the seal. */
  check: string;
  /** The dotted ring around the seal, and the rahl. */
  accent: string;
  /** The book's binding edge and gutter. */
  book: string;
  pages: string;
  /** The faint text lines on the pages. */
  trim: string;
};

export const markViewBox = { x: 7, y: 10, width: 50, height: 51 } as const;

export const markPalettes = {
  // Sand and paper backgrounds (the site, light splash screen).
  onLight: {
    seal: "#0B5D3E",
    check: "#FBFAF5",
    accent: "#C69A4B",
    book: "#0B5D3E",
    pages: "#FBFAF5",
    trim: "#C69A4B",
  },
  // The deep-green app icon tile and dark splash screen.
  onDark: {
    seal: "#D6B264",
    check: "#0B5D3E",
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

// The seal, shared by the full mark and the favicon. The dotted ring blurs
// into a smudge at favicon size, so the favicon leaves it out.
function sealElements(palette: MarkPalette, cx: number, cy: number, r: number, withRing: boolean) {
  const k = r / 10;
  const n = (value: number) => Number(value.toFixed(2));
  const ring = withRing
    ? `<circle cx="${cx}" cy="${cy}" r="${n(12.5 * k)}" fill="none" stroke="${palette.accent}" stroke-width="${n(k)}" stroke-dasharray="${n(1.6 * k)} ${n(1.6 * k)}"/>`
    : "";

  return [
    `<g class="sanad-mark-seal">`,
    ring,
    `<circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="${palette.seal}"/>`,
    `<path d="M${n(cx - 4.5 * k)} ${n(cy + 0.3 * k)}L${n(cx - 1.4 * k)} ${n(cy + 3.3 * k)}L${n(cx + 4.6 * k)} ${n(cy - 3 * k)}" fill="none" stroke="${palette.check}" stroke-width="${n(2.4 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</g>`,
  ].join("");
}

export function markElements(palette: MarkPalette): string {
  // Everything behind the book is masked by its outline plus a small gap.
  return [
    `<defs><mask id="sanad-mark-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">`,
    `<rect width="64" height="64" fill="#fff"/>`,
    `<path d="${pages}" fill="#000" stroke="#000" stroke-width="${gap * 2}" stroke-linejoin="round"/>`,
    `</mask></defs>`,
    `<g mask="url(#sanad-mark-gap)">`,
    `<path d="${rahl}" stroke="${palette.accent}" stroke-width="3.8" stroke-linecap="round"/>`,
    `</g>`,
    sealElements(palette, 32, 24, 10, true),
    `<path d="${pages}" fill="${palette.pages}"/>`,
    `<path d="${binding}" fill="none" stroke="${palette.book}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<path d="M32 43.6V49.6" stroke="${palette.book}" stroke-width="1.4"/>`,
    `<path d="${lines}" fill="none" stroke="${palette.trim}" stroke-width="1" stroke-linecap="round"/>`,
  ].join("");
}

// The favicon at 16-32px: the seal alone, which stays readable where the
// book and stand would blur.
export const faviconViewBox = { x: 4, y: 4, width: 56, height: 56 } as const;

export function faviconElements(palette: MarkPalette): string {
  return sealElements(palette, 32, 32, 27, false);
}

export function markViewBoxAttribute(): string {
  const { x, y, width, height } = markViewBox;
  return `${x} ${y} ${width} ${height}`;
}
