import type { TranslationKey } from "@/lib/i18n";

type HomeHeroProps = {
  t: (key: TranslationKey) => string;
};

export function HomeHero({ t }: HomeHeroProps) {
  return (
    <>
      <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-[var(--color-green)]/10 bg-[var(--color-green)]/5 px-4 py-2 text-xs font-bold text-[var(--color-green)]">
        <span className="h-2 w-2 rounded-full bg-[var(--color-green)]" aria-hidden="true" />
        {t("home.eyebrow")}
      </p>
      <h1 className="animate-rise mt-4 text-balance text-[2.15rem] font-bold leading-[1.2] tracking-tight text-[var(--color-ink)] [animation-delay:80ms] sm:mt-5 sm:text-[3.5rem]">
        {t("home.title")}
      </h1>
    </>
  );
}
