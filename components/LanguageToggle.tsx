"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      className={
        "inline-flex items-center rounded-md border border-border bg-surface p-0.5 text-xs font-mono " +
        className
      }
      role="group"
      aria-label={t.locale.switchTo}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={
          "rounded-[5px] px-2 py-1 transition-colors " +
          (lang === "en"
            ? "bg-surface-2 text-ink"
            : "text-ink-muted hover:text-ink")
        }
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("cs")}
        aria-pressed={lang === "cs"}
        className={
          "rounded-[5px] px-2 py-1 transition-colors " +
          (lang === "cs"
            ? "bg-surface-2 text-ink"
            : "text-ink-muted hover:text-ink")
        }
      >
        CZ
      </button>
    </div>
  );
}
