"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  defaultLanguage,
  dictionaries,
  getLanguageDirection,
  isLanguage,
  languageStorageKey,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const languageChangeEvent = "sanad-language-change";

function applyDocumentLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = getLanguageDirection(language);
  document.documentElement.dataset.language = language;
}

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  const savedLanguage = window.localStorage.getItem(languageStorageKey);
  return isLanguage(savedLanguage) ? savedLanguage : defaultLanguage;
}

function subscribeToLanguageChange(onStoreChange: () => void) {
  window.addEventListener(languageChangeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(languageChangeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguageChange, getStoredLanguage, () => defaultLanguage);

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  function setLanguage(nextLanguage: Language) {
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    window.dispatchEvent(new Event(languageChangeEvent));
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => dictionaries[language][key],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (context === null) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}
