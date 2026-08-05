"use client";

import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { PDF_PATH, CODE_URL } from "@/lib/content";

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
        <a
          href="#top"
          className="flex min-w-0 items-center gap-2 text-ink"
        >
          <span className="font-serif text-xl italic leading-none text-verify">
            e
          </span>
          <span className="truncate font-mono text-sm font-semibold tracking-tight">
            {t.header.home}
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <a
            href={CODE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink sm:inline-flex"
          >
            {t.header.viewCode}
          </a>
          <a
            href={PDF_PATH}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-canvas transition-colors hover:bg-ink-soft"
          >
            <DownloadIcon />
            <span className="hidden sm:inline">{t.header.downloadPdf}</span>
            <span className="sm:hidden">PDF</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M7 1v8m0 0 3-3m-3 3L4 6M2 11h10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
