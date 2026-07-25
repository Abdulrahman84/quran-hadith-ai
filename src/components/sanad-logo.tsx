type SanadLogoProps = {
  className?: string;
};

export function SanadLogo({ className = "" }: SanadLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={`sanad-logo ${className}`}
      fill="none"
      viewBox="0 0 644 251"
    >
      <svg height="90" viewBox="356 41 413 123" width="301" x="0" y="45">
        <image
          height="251"
          href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
          width="900"
        />
      </svg>
      <circle cx="124.3" cy="53.4" fill="var(--color-gold)" r="9" />
      <svg height="43" viewBox="529 195 301 43" width="301" x="0" y="164">
        <image
          height="251"
          href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
          width="900"
        />
      </svg>
      <svg height="251" viewBox="0 0 303 251" width="303" x="341" y="0">
        <image
          height="251"
          href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
          width="900"
        />
      </svg>
    </svg>
  );
}
