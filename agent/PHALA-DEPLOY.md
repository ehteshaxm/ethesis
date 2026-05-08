# Deploying the ETHesis agent to Phala Cloud (Intel TDX)

The agent runtime is Docker-native. Phala Cloud runs any Docker image
inside an Intel TDX Confidential VM and produces a verifiable attestation
that *this specific image hash* is running in *this specific TDX enclave*.

When the agent runs inside a Phala CVM:

- `agent/tee.ts:isInTee()` returns `true` (DStack socket is mounted)
- Each cycle calls `getCycleQuote()` and binds a TDX V4 quote to the
  attestation's IPFS CID + agent address + venture ENS — anyone can
  verify against Intel PCS that the attestation came from a genuine TDX
- Each cycle emits an event to RTMR3 (`ethesis.attestation`) so the
  cumulative event log is tamper-evident
- The runtime startup banner prints `app_id`, `instance_id`,
  `compose_hash`, and `mr_aggregated` so the deployment is identifiable

Outside a CVM, the SDK gracefully reports `isReachable() === false`,
all TEE helpers no-op, and the agent runs with the existing
keccak-derived wallet path.

## One-time setup

1. Sign up at https://cloud.phala.com (free tier exists)
2. Create a Docker Hub account if you don't have one (free, public images
   are fine)

## Deploy steps

From the repo root:

```sh
# 1. Build for amd64 (Phala TDX is x86)
docker build --platform linux/amd64 -t <your-dockerhub-user>/ethesis-agent:latest \
  -f agent/Dockerfile .

# 2. Push to Docker Hub
docker push <your-dockerhub-user>/ethesis-agent:latest

# 3. Edit agent/docker-compose.yml — replace `your-dockerhub-user` with
#    your actual Docker Hub username

# 4. In the Phala Cloud UI:
#    - Click "Create CVM" → "Custom Compose"
#    - Paste the docker-compose.yml content
#    - Set environment variables in the "Encrypted Environment" panel:
#        DATABASE_URL=postgresql://...
#        AGENT_MASTER_SEED=<your seed>
#        ANTHROPIC_API_KEY=sk-ant-...
#        PINATA_JWT=eyJ...
#        PLATFORM_ENS_OWNER_PRIVATE_KEY=0x...
#        ...etc (see docker-compose.yml for the full list)
#    - Click "Deploy"

# 5. After ~2 minutes, the CVM is running. Phala dashboard shows live
#    logs. The agent's startup banner prints the TDX attestation info.
```

## Verifying the attestation

Each attestation row in `agent_activity_log.details.teeQuote` carries:

- `quote` — the raw TDX quote (hex)
- `reportData` — `keccak256(ipfsCid || agentAddress || ventureEnsName)`

To verify externally, submit `quote` to Intel's PCS or Phala's verification
service. The `reportData` should match the on-chain attestation's
`org.ethesis.attestation.{N}` IPFS CID + agent address.

This gives the agent a chain of custody:

> agent code (compose_hash) → TDX enclave (mr_aggregated) →
> attestation (signed by deterministic agent wallet, bound to cTRNG nonce) →
> IPFS CID (pinned by Pinata) → ENS text record (`org.ethesis.attestation.N`)

Removing any link breaks the chain. That's the bounty story.

## Local-mode parity

`agent/tee.ts` is import-safe: outside a CVM, every helper returns null/
no-ops. So `pnpm agent:run-once` keeps working locally — just without
TDX attestation. This means you can develop and test against the same
codebase that ships to Phala.
