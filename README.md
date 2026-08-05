# Adaptive Portfolio Optimization

A bilingual (English / Czech) presentation site for the Master's thesis
**Adaptive Portfolio Optimization** by Bc. Tomáš Procházka — Faculty of Nuclear
Sciences and Physical Engineering, Czech Technical University in Prague
(2025/2026).

The site presents the abstract, the solution pipeline, the core contributions,
the table of contents, experimental findings, future directions, and the
references — and lets visitors download the full thesis as a PDF.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 (design tokens in `app/globals.css`)
- Client-side i18n (EN/CZ) — no backend, fully static

## Local dev

```sh
pnpm install
pnpm dev
```

Then open http://localhost:3000.

## Content & translations

All user-facing copy lives in `lib/content.ts`, keyed by locale (`en` / `cs`).
The English object is the source of truth for the shape; the Czech object is
type-checked against it, so a missing translation is a compile error. The
language toggle is wired through `lib/i18n.tsx` and persisted to
`localStorage`.

The thesis PDF is served from
`public/Prochazka-Adaptive-Portfolio-Optimization.pdf`.

## Layout

```
app/          Next.js App Router (layout, page, favicon)
components/   UI (SiteHeader, SiteFooter, PipelineDiagram, LanguageToggle)
lib/          content dictionary, i18n provider, utils
public/       thesis PDF + static assets
```
