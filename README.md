# ETHesis

A platform for funding agentic research ventures. Researchers launch tokenized ventures. Funders buy tokens. When the treasury crosses an activation threshold, an AI agent activates, runs continuously, and uses venture funds (via x402) to verify the team's progress against their declared plan. Every attestation is signed and anchored in ENS.

Built for ETHPrague 2026.

## Status

Session 1 (foundation) complete: Next.js + Tailwind v4 + Drizzle schema + base components + homepage preview rendering 6 mock ventures across all four stages (idea, auction, live, wound-down).

Subsequent sessions will add the venture page, launch wizard, brain chat, agent runtime, and Apify Actors.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 (design tokens in `app/globals.css`)
- Drizzle ORM + Neon (Postgres + pgvector) — schema only, not yet wired
- pnpm

## Local dev

```sh
pnpm install
pnpm dev
```

Then open http://localhost:3000.

To regenerate DB migrations after schema changes:

```sh
pnpm db:generate
```

When a Neon DB is available, see `MIGRATE_NOTES.md`.

## Layout

```
app/                  Next.js App Router routes
components/           UI primitives (VentureCard, ScoreBlock, …)
db/                   Drizzle schema, migrations, seed
lib/                  Utilities + mock service stubs
agent/                Agent runtime (separate Railway/Fly service — empty for now)
apify-actors/         Apify Actor source (separate Apify projects — empty for now)
```
