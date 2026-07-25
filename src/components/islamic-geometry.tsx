type IslamicGeometryProps = {
  className?: string;
  variant: "lattice" | "steps" | "weave";
};

export function IslamicGeometry({ className = "", variant }: IslamicGeometryProps) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute fill-none stroke-current ${className}`}
      focusable="false"
      viewBox="0 0 160 160"
    >
      {variant === "lattice" ? <LatticeLines /> : null}
      {variant === "steps" ? <SteppedLines /> : null}
      {variant === "weave" ? <WovenLines /> : null}
    </svg>
  );
}

function LatticeLines() {
  return (
    <g strokeWidth="1">
      <path d="M48 8h64l40 40v64l-40 40H48L8 112V48L48 8Z" />
      <path d="m80 24 56 56-56 56-56-56 56-56Z" />
      <path d="M48 48h64v64H48V48Z" />
      <path d="M48 8v40H8m104-40v40h40M48 152v-40H8m104 40v-40h40" />
    </g>
  );
}

function SteppedLines() {
  return (
    <g strokeWidth="1">
      <path d="M0 160h32v-32h32V96h32V64h32V32h32" />
      <path d="M0 136h24v-24h32V80h32V48h32V16h24" />
      <path d="M16 160v-24h32v-32h32V72h32V40h32V8h16" />
    </g>
  );
}

function WovenLines() {
  return (
    <g strokeWidth="1">
      <path d="M0 40h40V0m80 0v40h40M160 120h-40v40m-80 0v-40H0" />
      <path d="M40 40h80v80H40V40Z" />
      <path d="m40 40 80 80m0-80-80 80" />
      <path d="M80 0v40M160 80h-40M80 160v-40M0 80h40" />
    </g>
  );
}
