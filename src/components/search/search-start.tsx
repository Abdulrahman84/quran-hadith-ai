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
      <div className="home-suggestions animate-rise [animation-delay:200ms]">
        <p className="home-section-label">{t("home.tryLabel")}</p>
        <ul>
          {suggestionKeys.map((suggestionKey) => (
            <li key={suggestionKey}>
              <button className="suggestion-row" onClick={() => onSuggestion(t(suggestionKey))} type="button">
                <span>{t(suggestionKey)}</span>
                <svg aria-hidden="true" className="suggestion-arrow rtl:rotate-180" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <aside className="home-note animate-rise [animation-delay:260ms]">
        <p className="home-note-title">{t("home.startTitle")}</p>
        <p className="home-note-text">{t("home.startText")}</p>
      </aside>
    </>
  );
}
