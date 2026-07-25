type SanadLogoProps = {
  className?: string;
};

export function SanadLogo({ className = "" }: SanadLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={`sanad-logo ${className}`}
      fill="none"
      viewBox="0 0 900 251"
    >
      <image
        height="251"
        href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
        preserveAspectRatio="xMinYMid meet"
        width="900"
      />
    </svg>
  );
}
