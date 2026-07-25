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
      <svg height="251" viewBox="330 0 570 251" width="570" x="0" y="0">
        <image
          height="251"
          href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
          width="900"
        />
      </svg>
      <svg height="251" viewBox="0 0 330 251" width="330" x="570" y="0">
        <image
          height="251"
          href="/brand/sanad-logo-gold-forward.png?v=gold-forward"
          width="900"
        />
      </svg>
    </svg>
  );
}
