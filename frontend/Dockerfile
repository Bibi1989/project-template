# -----------------------------------------------------------------------------
# Frontend — Next.js (standalone, multi-stage)
# Chainguard bases: 0 critical / 0 high CVEs (vs node:22-alpine 1C/5H).
# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/node:latest-dev AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/node:latest-dev AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/node:latest AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Chainguard node runs as uid 65532 (nonroot)
COPY --from=builder --chown=65532:65532 /app/public ./public
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static

USER 65532

EXPOSE 3000

# No shell in the runtime image — use Kubernetes HTTP probes for health checks.
# Image entrypoint is `node`.
CMD ["server.js"]
