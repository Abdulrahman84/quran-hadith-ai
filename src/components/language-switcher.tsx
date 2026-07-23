"use client";

import { useI18n } from "@/components/i18n-provider";
import { languages } from "@/lib/i18n";

export function LanguageSwitcher({
  idPrefix = "language",
  onLanguageChange,
}: {
  idPrefix?: string;
  onLanguageChange?: () => void;
}) {
  const { language, setLanguage, t } = useI18n();
  const selectId = `${idPrefix}-select`;

  return (
    <>
      <label className="sr-only" htmlFor={selectId}>
        {t("language.label")}
      </label>
      <select
        className="language-select"
        id={selectId}
        onChange={(event) => {
          setLanguage(event.target.value as typeof language);
          onLanguageChange?.();
        }}
        value={language}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <div aria-label={t("language.label")} className="language-switcher" role="group">
        {languages.map((item) => (
          <button
            aria-pressed={language === item.code}
            className="language-option"
            data-active={language === item.code}
            key={item.code}
            onClick={() => {
              setLanguage(item.code);
              onLanguageChange?.();
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
