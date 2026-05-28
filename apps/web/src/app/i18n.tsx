import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations } from "./i18n/translations";

export type Language = "ru" | "kk" | "en";

export const languageOptions: Array<{ code: Language; label: string; name: string }> = [
  { code: "ru", label: "RU", name: "Русский" },
  { code: "kk", label: "KZ", name: "Қазақша" },
  { code: "en", label: "EN", name: "English" },
];



type Dictionary = (typeof translations)[Language];

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const storageKey = "nerix-language";

function isLanguage(value: string | null): value is Language {
  return value === "ru" || value === "kk" || value === "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "ru";
    const saved = window.localStorage.getItem(storageKey);
    return isLanguage(saved) ? saved : "ru";
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: translations[language],
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
