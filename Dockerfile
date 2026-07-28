# ── Stage 1: build ────────────────────────────────────────────────
FROM node:24.18.0-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@11 && npm ci

COPY . .
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM node:24.18.0-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output includes only the modules actually used at runtime
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Next.js standalone file tracer skips native .so/.node files — copy them explicitly.
# @duckdb/node-api uses a platform-specific prebuilt binary (libduckdb.so) that
# won't be found otherwise.
COPY --from=builder /app/node_modules/@duckdb ./node_modules/@duckdb

# Create data directory structure; this is volume-mounted at runtime
# so these dirs are only used if no volume is provided (e.g. quick tests)
RUN mkdir -p /app/data/uploads/resumes /app/data/uploads/adapted

# Run as non-root (node user ships in the official alpine image)
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
