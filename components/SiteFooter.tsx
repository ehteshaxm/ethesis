"use client";

import { useI18n } from "@/lib/i18n";
import { PDF_PATH, CODE_URL } from "@/lib/content";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              {t.footer.ackHeading}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-ink-soft">
              {t.footer.ack}
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              {t.footer.fundingHeading}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-ink-soft">
              {t.footer.funding}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 text-xs text-ink-muted sm:flex-row sm:items-center">
          <p className="font-mono">{t.footer.rights}</p>
          <ul className="flex items-center gap-5">
            <li>
              <a
                className="transition-colors hover:text-ink"
                href={PDF_PATH}
                download
              >
                {t.header.downloadPdf}
              </a>
            </li>
            <li>
              <a
                className="transition-colors hover:text-ink"
                href={CODE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
