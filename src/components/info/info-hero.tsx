type InfoHeroProps = {
  eyebrow: string;
  title: string;
  intro: string;
};

export function InfoHero({ eyebrow, title, intro }: InfoHeroProps) {
  return (
    <div className="animate-rise">
      <p className="page-kicker">{eyebrow}</p>
      <h1 className="info-title">{title}</h1>
      <p className="info-intro">{intro}</p>
    </div>
  );
}
