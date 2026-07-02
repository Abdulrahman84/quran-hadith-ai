"use client";

import { useI18n } from "@/components/i18n-provider";
import { languages } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <>
      <label className="sr-only" htmlFor="language-select">
        {t("language.label")}
      </label>
      <select
        className="language-select"
        id="language-select"
        onChange={(event) => setLanguage(event.target.value as typeof language)}
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
            onClick={() => setLanguage(item.code)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
