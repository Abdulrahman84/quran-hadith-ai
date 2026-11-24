// The Sanad mark as plain SVG markup, so the header logo, favicon, app icons,
// splash screens and loader all draw from one source.
// scripts/generate-brand-assets.mjs imports this file directly with Node.
//
// An open book with the gold assistant set into its gutter: the answer sits
// inside the source text, never above it. Drawn on a 64-unit grid with one
// stroke weight for the covers and one for the pages, so it stays legible
// down to a 16px favicon.

export type MarkPalette = {
  book: string;
  pages: string;
  pagesOpacity: number;
  accent: string;
  visor: string;
  eyes: string;
};

export const markViewBox = { x: 3, y: 7, width: 58, height: 51 } as const;

export const markPalettes = {
  // Sand and paper backgrounds (the site, light splash screen).
  onLight: {
    book: "#0B5D3E",
    pages: "#0B5D3E",
    pagesOpacity: 0.45,
    accent: "#C69A4B",
    visor: "#0B5D3E",
    eyes: "#FBFAF5",
  },
  // The deep-green app icon tile and dark splash screen.
  onDark: {
    book: "#FBFAF5",
    pages: "#FBFAF5",
    pagesOpacity: 0.55,
    accent: "#D6B264",
    visor: "#0B5D3E",
    eyes: "#FBFAF5",
  },
} satisfies Record<string, MarkPalette>;

// Each cover runs from the gutter, out along the top edge, down the fore-edge
// and back to the spine. The two halves leave a gap at the gutter for the head.
const covers =
  "M24.5 17.5C19.5 12.8 13.2 10.5 6 10.5V48C14.2 48 22 50.2 28.6 54.5" +
  "M39.5 17.5C44.5 12.8 50.8 10.5 58 10.5V48C49.8 48 42 50.2 35.4 54.5";
const pages =
  "M12.5 17V42.2C18.6 42.6 23.6 44.2 27.6 46.8" + "M51.5 17V42.2C45.4 42.6 40.4 44.2 36.4 46.8";

export function markElements(palette: MarkPalette): string {
  return [
    `<path d="${covers}" fill="none" stroke="${palette.book}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${pages}" fill="none" stroke="${palette.pages}" stroke-opacity="${palette.pagesOpacity}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<g class="sanad-mark-head">`,
    `<path d="M32 26.5V21.5" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round"/>`,
    `<circle class="sanad-mark-signal" cx="32" cy="18.6" r="3" fill="${palette.accent}"/>`,
    `<rect x="19" y="26" width="26" height="18" rx="9" fill="${palette.accent}"/>`,
    `<rect x="23.5" y="30.5" width="17" height="9" rx="4.5" fill="${palette.visor}"/>`,
    `<circle class="sanad-mark-eye" cx="28" cy="35" r="2" fill="${palette.eyes}"/>`,
    `<circle class="sanad-mark-eye" cx="36" cy="35" r="2" fill="${palette.eyes}"/>`,
    `</g>`,
  ].join("");
}

export function markViewBoxAttribute(): string {
  const { x, y, width, height } = markViewBox;
  return `${x} ${y} ${width} ${height}`;
}
