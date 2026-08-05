"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { content, type Content, type Lang } from "./content";

const STORAGE_KEY = "ethesis-lang";
const DEFAULT_LANG: Lang = "en";

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: Content;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "cs";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Restore the saved preference (or the browser's) after mount. We
  // deliberately render the default on the server and reconcile on the
  // client, so this synchronous setState-in-effect is expected.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(saved);
      return;
    }
    if (navigator.language?.toLowerCase().startsWith("cs")) {
      setLangState("cs");
    }
  }, []);

  // Keep <html lang> and the stored preference in sync.
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = (next: Lang) => setLangState(next);
  const toggle = () => setLangState((prev) => (prev === "en" ? "cs" : "en"));

  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t: content[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}
