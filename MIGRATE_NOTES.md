# DB migration notes

The schema in `db/schema.ts` uses pgvector (`embedding vector(1536)` on `kb_chunks`). Before running `pnpm db:migrate`, the target Neon database needs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run that once via Neon's SQL editor (or `psql`) on the target DB, then:

```sh
pnpm db:migrate
pnpm seed
```

`seed` currently only logs — the next session wires the actual Drizzle inserts. Mock data lives in `lib/mock-data.ts` and is the source of truth until then.
