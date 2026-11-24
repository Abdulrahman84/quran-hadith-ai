import type { TranslationKey } from "@/lib/i18n";

const suggestionKeys: TranslationKey[] = [
  "home.suggestion.intention",
  "home.suggestion.mercy",
  "home.suggestion.prayer",
];

type SearchStartProps = {
  onSuggestion: (question: string) => void;
  t: (key: TranslationKey) => string;
};

export function SearchStart({ onSuggestion, t }: SearchStartProps) {
  return (
    <>
      <div className="animate-rise mt-5 w-full max-w-3xl [animation-delay:220ms]">
        <div className="flex w-full flex-wrap justify-center gap-2">
          {suggestionKeys.map((suggestionKey) => (
            <button
              className="chip w-full justify-center whitespace-normal text-center sm:w-auto"
              key={suggestionKey}
              onClick={() => onSuggestion(t(suggestionKey))}
              type="button"
            >
              {t(suggestionKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-rise relative mt-8 w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-5 shadow-inner [animation-delay:300ms] sm:mt-10 sm:p-9">
        <span className="absolute -end-7 -top-7 h-28 w-28 rounded-full border border-[var(--color-gold)]/20" aria-hidden="true" />
        <p className="relative text-base font-bold text-[var(--color-green)]">
          {t("home.startTitle")}
        </p>
        <p className="relative mx-auto mt-3 max-w-xl text-sm font-medium leading-7 text-[var(--color-muted)]">
          {t("home.startText")}
        </p>
      </div>
    </>
  );
}
