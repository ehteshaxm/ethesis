# ETHesis agent runtime

OpenClaw-style verification agent. One agent per venture — runs continuously, watches the venture's connected sources via Apify, generates signed attestations via Claude, pins them to IPFS, and writes the IPFS CIDs to the agent's ENS text records.

## Run modes

**Continuous** — production-shape, polls every minute and runs a cycle for any venture whose `agentLastSyncAt` is older than 4 hours:

```sh
pnpm agent:dev
```

**One-shot** — useful for testing a single venture end-to-end:

```sh
pnpm agent:run-once olympia-protein-folding.ethesis.eth
```

Both modes print which integrations are configured vs running in mock mode.

## Files

```
agent/
├── runtime.ts          # main loop (poll + tick)
├── cycle.ts            # per-venture cycle
├── run-once.ts         # one-shot CLI
├── anthropic-client.ts # Claude wrapper with structured-JSON output
├── apify-client.ts     # Apify Actor caller (Output Watcher); mock fallback
├── attestation.ts      # generate + sign + pin
├── ens-writer.ts       # write attestation CIDs to ENS text records
├── ipfs.ts             # Pinata client; mock-CID fallback
├── scoring.ts          # Progress + Promise score calc per spec Part 8
├── wallet.ts           # derives per-venture agent wallet from AGENT_MASTER_SEED
└── db.ts               # Drizzle client (reuses ../db/schema.ts)
```

## Env vars (each is optional — agent falls back to mocks)

| Var | Purpose | Without it |
|---|---|---|
| `DATABASE_URL` | **Required.** Neon connection. | Agent won't start. |
| `AGENT_MASTER_SEED` | **Required.** Derives per-venture agent wallets. | Agent won't start. |
| `ANTHROPIC_API_KEY` | Claude attestation reasoning | Synthesizes a deterministic fallback attestation. |
| `APIFY_TOKEN` + `APIFY_ACTOR_ID_OUTPUT_WATCHER` | Real Apify Output Watcher Actor | Returns a mock set of GitHub/arXiv/HF outputs. |
| `PINATA_JWT` | Pin attestation payloads to IPFS | Returns a mock-shaped CID; payloads aren't actually pinned. |
| `PLATFORM_ENS_OWNER_PRIVATE_KEY` + `PLATFORM_ENS_NAME` + `PLATFORM_ENS_CHAIN` | Write attestation CIDs to ENS text records | Skips ENS writes (logs reason). |

## What it actually does each cycle

1. Reads venture + milestones + connected sources from Neon
2. Calls Apify Output Watcher (or mock) for each source — gets `ScrapedOutput[]`
3. Sends mandate + milestones + outputs to Claude with the attestation JSON schema
4. Receives a structured `{type, milestoneOrdinal, summary, evidence, kbCheck, confidence}` draft
5. Signs the canonical JSON with the agent's derived wallet (deterministic from `AGENT_MASTER_SEED + slug`)
6. Pins the signed payload to IPFS via Pinata → CID
7. Writes the CID to ENS as `org.ethesis.attestation.{ordinal}` text record on the agent's subname (e.g. `auditor.olympia-protein-folding.ethesis.eth`)
8. Inserts the row into `attestations` table — Pulse tab reads from here

## Deploying

The runtime is a long-lived Node process. Don't deploy it on Vercel (their functions are short-lived). Targets:

- **Railway:** `railway init` → set env vars → `railway up`. Project type: Node.
- **Fly.io:** `fly launch --no-deploy`, edit `fly.toml` to run `pnpm agent:dev`, `fly secrets set ...`, `fly deploy`.

## Notes

- ENS writes are sequential (single `setText` per attestation). Could be batched via `multicall` once the per-cycle volume justifies it.
- The agent does NOT write directly to the venture subname; only the agent's own subname (`auditor.<slug>.<parent>`). This isolates rotation: a compromised agent key only damages that one agent's records.
