// The Sanad mark as plain SVG markup, so the header logo, favicon, app icons,
// splash screens and loader all draw from one source.
// scripts/generate-brand-assets.mjs imports this file directly with Node.
//
// An open book (the text, matn) with three linked gold points rising from its
// spine: the sanad, the chain of narration that ties a text back to its source.

export type MarkPalette = {
  book: string;
  pageFill: string;
  lines: string;
  linesOpacity: number;
  chain: string;
};

export const markViewBox = { x: 6, y: 5, width: 52, height: 56 } as const;

export const markPalettes = {
  // Sand and paper backgrounds (the site, light splash screen).
  onLight: {
    book: "#0B5D3E",
    pageFill: "#FFFEFA",
    lines: "#0B5D3E",
    linesOpacity: 0.34,
    chain: "#B8893A",
  },
  // The deep-green app icon tile and dark splash screen.
  onDark: {
    book: "#FBFAF5",
    pageFill: "none",
    lines: "#FBFAF5",
    linesOpacity: 0.42,
    chain: "#D6B264",
  },
} satisfies Record<string, MarkPalette>;

const pages =
  "M32 34.5C26.2 30.6 18.6 29.4 10 30.2V54.4C18.6 53.6 26.2 54.8 32 58.6 37.8 54.8 45.4 53.6 54 54.4V30.2C45.4 29.4 37.8 30.6 32 34.5Z";
const spine = "M32 34.5V58.6";
const lines = "M15 37.4H26M15 42.4H26M15 47.4H23M38 37.4H49M38 42.4H49M41 47.4H49";

export function markElements(palette: MarkPalette): string {
  return [
    `<path d="${pages}" fill="${palette.pageFill}" stroke="${palette.book}" stroke-width="3.2" stroke-linejoin="round"/>`,
    `<path d="${spine}" stroke="${palette.book}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="${lines}" stroke="${palette.lines}" stroke-opacity="${palette.linesOpacity}" stroke-width="2" stroke-linecap="round"/>`,
    `<g class="sanad-mark-chain" fill="${palette.chain}">`,
    `<path d="M32 12.5V33" stroke="${palette.chain}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path class="sanad-mark-link" d="M32 22.2 35.6 26.4 32 30.6 28.4 26.4Z"/>`,
    `<path class="sanad-mark-link" d="M32 14.2 35 17.7 32 21.2 29 17.7Z"/>`,
    `<path class="sanad-mark-link" d="M32 7.4 34.4 10.2 32 13 29.6 10.2Z"/>`,
    `</g>`,
  ].join("");
}

export function markViewBoxAttribute(): string {
  const { x, y, width, height } = markViewBox;
  return `${x} ${y} ${width} ${height}`;
}
