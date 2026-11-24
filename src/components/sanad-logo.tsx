import { markElements, markPalettes, markViewBoxAttribute } from "@/lib/brand-mark";

type SanadMarkProps = {
  className?: string;
  tone?: keyof typeof markPalettes;
};

const markMarkup = {
  onLight: markElements(markPalettes.onLight),
  onDark: markElements(markPalettes.onDark),
};

export function SanadMark({ className = "", tone = "onLight" }: SanadMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={`sanad-mark ${className}`}
      dangerouslySetInnerHTML={{ __html: markMarkup[tone] }}
      viewBox={markViewBoxAttribute()}
    />
  );
}

type SanadLogoProps = {
  className?: string;
};

// Mark plus a live-text wordmark, so the logo stays crisp at any size and the
// Arabic name renders in the site's own typeface.
export function SanadLogo({ className = "" }: SanadLogoProps) {
  return (
    <span aria-hidden="true" className={`sanad-logo ${className}`}>
      <SanadMark />
      <span className="sanad-logo-wordmark">
        <span className="sanad-logo-arabic" lang="ar">
          سند
        </span>
        <span className="sanad-logo-latin" lang="en">
          Sanad AI
        </span>
      </span>
    </span>
  );
}
