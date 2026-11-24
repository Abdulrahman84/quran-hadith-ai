import type { TranslationKey } from "@/lib/i18n";

type HomeHeroProps = {
  t: (key: TranslationKey) => string;
};

export function HomeHero({ t }: HomeHeroProps) {
  return (
    <>
      <p className="home-kicker animate-rise">{t("home.eyebrow")}</p>
      <h1 className="home-title animate-rise [animation-delay:60ms]">{t("home.title")}</h1>
      <p className="home-lede animate-rise [animation-delay:120ms]">{t("home.lede")}</p>
    </>
  );
}
