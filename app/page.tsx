"use client";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { useI18n } from "@/lib/i18n";
import { PDF_PATH, CODE_URL } from "@/lib/content";

export default function Home() {
  const { t } = useI18n();

  const navItems = [
    { id: "abstract", label: t.nav.abstract },
    { id: "pipeline", label: t.nav.pipeline },
    { id: "contributions", label: t.nav.contributions },
    { id: "chapters", label: t.nav.chapters },
    { id: "findings", label: t.nav.findings },
    { id: "future", label: t.nav.future },
    { id: "references", label: t.nav.references },
  ];

  return (
    <main id="top" className="flex-1">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12">
        <p className="font-mono text-[11px] uppercase tracking-wider text-verify-ink">
          {t.hero.kicker}
        </p>
        <h1
          className="mt-4 text-ink"
          style={{
            fontSize: "clamp(38px, 5.4vw, 68px)",
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.03,
            maxWidth: "18ch",
          }}
        >
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          {t.hero.lead}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={PDF_PATH}
            download
            className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-ink-soft"
          >
            {t.hero.downloadPdf}
          </a>
          <a
            href={CODE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            {t.hero.viewCode} →
          </a>
        </div>

        {/* Metadata card */}
        <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-6 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label={t.hero.authorLabel} value={t.hero.author} />
          <Meta
            label={t.hero.supervisorLabel}
            value={t.hero.supervisor}
            note={t.hero.supervisorAffil}
          />
          <Meta
            label={t.hero.coSupervisorLabel}
            value={t.hero.coSupervisor}
            note={t.hero.coSupervisorAffil}
          />
          <Meta
            label={t.hero.university}
            value={t.hero.faculty}
            note={t.hero.department}
          />
          <Meta label={t.hero.programLabel} value={t.hero.program} />
          <Meta label={t.hero.submittedLabel} value={t.hero.submitted} />
        </dl>
      </section>

      {/* ── Section nav ──────────────────────────────────────── */}
      <nav className="sticky top-14 z-20 border-y border-border bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto max-w-5xl overflow-x-auto px-6">
          <ul className="flex items-center gap-1 py-2 text-sm whitespace-nowrap">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ── Abstract ─────────────────────────────────────────── */}
      <Section id="abstract" title={t.abstract.heading}>
        <p className="max-w-3xl text-base leading-relaxed text-ink-soft">
          {t.abstract.body}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            {t.abstract.keywordsLabel}
          </span>
          {t.abstract.keywords.map((k) => (
            <span
              key={k}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft"
            >
              {k}
            </span>
          ))}
        </div>
      </Section>

      {/* ── Approach / pipeline ──────────────────────────────── */}
      <Section id="pipeline" title={t.pipeline.heading}>
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(320px,420px)] lg:items-start">
          <p className="max-w-xl text-base leading-relaxed text-ink-soft">
            {t.pipeline.intro}
          </p>
          <PipelineDiagram />
        </div>
      </Section>

      {/* ── Contributions ────────────────────────────────────── */}
      <Section id="contributions" title={t.contributions.heading}>
        <p className="max-w-3xl text-base leading-relaxed text-ink-soft">
          {t.contributions.intro}
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {t.contributions.items.map((c, i) => (
            <li
              key={c.section}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-2xl font-semibold tabular-nums text-verify">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
                  {c.section}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold leading-snug text-ink">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {c.desc}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Contents / chapters ──────────────────────────────── */}
      <Section id="chapters" title={t.chapters.heading}>
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {t.chapters.items.map((ch) => (
            <li key={ch.n} className="flex gap-4 px-5 py-4 sm:gap-6 sm:px-6">
              <span className="w-10 shrink-0 font-mono text-lg font-semibold tabular-nums text-ink-subtle">
                {ch.n}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink">{ch.title}</h3>
                {ch.sub.length > 0 ? (
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                    {ch.sub.map((s) => (
                      <li key={s} className="flex items-center gap-1.5">
                        <span className="text-ink-subtle">·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Findings ─────────────────────────────────────────── */}
      <Section id="findings" title={t.findings.heading}>
        <p className="max-w-3xl text-base leading-relaxed text-ink-soft">
          {t.findings.intro}
        </p>
        <ul className="mt-6 max-w-3xl space-y-4">
          {t.findings.items.map((f, i) => (
            <li key={i} className="flex gap-3">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-verify"
                aria-hidden="true"
              />
              <span className="text-base leading-relaxed text-ink-soft">
                {f}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Future work ──────────────────────────────────────── */}
      <Section id="future" title={t.future.heading}>
        <div className="grid gap-4 sm:grid-cols-3">
          {t.future.items.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <h3 className="text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── References ───────────────────────────────────────── */}
      <Section id="references" title={t.references.heading}>
        <p className="text-sm text-ink-muted">{t.references.note}</p>
        <ol className="mt-6 max-w-3xl space-y-3">
          {t.references.items.map((r, i) => (
            <li key={i} className="flex gap-4 text-sm leading-relaxed">
              <span className="w-6 shrink-0 font-mono tabular-nums text-ink-subtle">
                [{i + 1}]
              </span>
              <span className="text-ink-soft">{r}</span>
            </li>
          ))}
        </ol>
      </Section>

      <SiteFooter />
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-5xl scroll-mt-28 border-t border-border-soft px-6 py-16"
    >
      <h2 className="mb-8 text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Meta({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
      {note ? <dd className="text-xs text-ink-muted">{note}</dd> : null}
    </div>
  );
}
