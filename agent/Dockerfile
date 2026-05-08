# ETHesis agent runtime — runs continuously inside a Phala Cloud
# Confidential VM (Intel TDX). Multi-stage build keeps the final image
# small and ensures the runtime ships with only what `tsx agent/runtime.ts`
# needs.

# ───── Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm via corepack (bundled with Node 20).
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy lockfile + manifest first for caching
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./

# Install full deps (we'll prune later)
RUN pnpm install --frozen-lockfile

# Copy the parts the agent runtime imports
COPY agent ./agent
COPY db ./db
COPY lib ./lib

# ───── Runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy node_modules + sources from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agent ./agent
COPY --from=builder /app/db ./db
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

ENV NODE_ENV=production

# DStack socket is mounted at /var/run/dstack.sock when the container runs
# inside a Phala CVM. The DStack SDK auto-detects it and reports
# isReachable() === true. Outside a CVM, the SDK gracefully reports false.

CMD ["pnpm", "exec", "tsx", "agent/runtime.ts"]
