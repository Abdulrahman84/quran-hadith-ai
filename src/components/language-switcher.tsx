"use client";

import { useI18n } from "@/components/i18n-provider";
import { languages } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
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
  );
}
