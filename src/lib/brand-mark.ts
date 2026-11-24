// The Sanad mark (open book with the gold assistant) as plain SVG markup, so the
// header logo, favicon, app icons and splash screens all draw from one source.
// scripts/generate-brand-assets.mjs imports this file directly with Node.

export type MarkPalette = {
  book: string;
  pages: string;
  pagesOpacity: number;
  accent: string;
  visor: string;
  eyes: string;
};

export const markViewBox = { x: 46, y: 12, width: 84, height: 72 } as const;

export const markPalettes = {
  // Sand and paper backgrounds (the site, splash screens).
  onLight: {
    book: "#0B5D3E",
    pages: "#18845A",
    pagesOpacity: 0.78,
    accent: "#C69A4B",
    visor: "#0B5D3E",
    eyes: "#FBFAF5",
  },
  // The deep-green app icon tile.
  onDark: {
    book: "#FBFAF5",
    pages: "#FBFAF5",
    pagesOpacity: 0.5,
    accent: "#D6B264",
    visor: "#0B5D3E",
    eyes: "#FBFAF5",
  },
} satisfies Record<string, MarkPalette>;

export function markElements(palette: MarkPalette): string {
  return [
    `<path d="M51 18c14 0 26 3 37 13 11-10 23-13 37-13v49c-15 0-27 4-37 12-10-8-22-12-37-12Z" stroke="${palette.book}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    `<path d="M59 27v33c11 1 21 4 29 10m29-43v33c-11 1-21 4-29 10V34" stroke="${palette.pages}" stroke-opacity="${palette.pagesOpacity}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    `<path d="M88 30v-7" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round"/>`,
    `<circle cx="88" cy="19" r="4" fill="${palette.accent}"/>`,
    `<rect x="69" y="30" width="38" height="28" rx="13" fill="${palette.accent}"/>`,
    `<rect x="75" y="36" width="26" height="15" rx="7" fill="${palette.visor}"/>`,
    `<circle cx="82" cy="43.5" r="2.2" fill="${palette.eyes}"/>`,
    `<circle cx="94" cy="43.5" r="2.2" fill="${palette.eyes}"/>`,
  ].join("");
}

export function markViewBoxAttribute(): string {
  const { x, y, width, height } = markViewBox;
  return `${x} ${y} ${width} ${height}`;
}
