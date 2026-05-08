# Agent runtime

Separate long-running service for ETHesis attestation agents. Will be deployed to Railway or Fly.io (NOT Vercel — needs a continuous loop).

Empty in Session 1. Lands in Session 4 (Hours 28–36 of the build plan):

- `src/runtime.ts` — main loop
- `src/triggers.ts` — Decision Market trigger logic
- `src/attestations.ts` — attestation generator (Anthropic SDK)
- `src/scoring.ts` — Progress + Promise score calculation
- `src/apify-client.ts` — calls Output Watcher / Cross-Reference Actors
- `src/x402-payment.ts` — x402 payment wrapper
- `src/wallet.ts` — per-venture wallet derivation (BIP-44)
- `src/ens-writer.ts` — writes attestation hashes to ENS text records
