# syntax=docker/dockerfile:1.7
#
# Multi-stage image for @emby-utils/server. The runtime stage is a minimal
# node:22-alpine with only production deps and compiled dist/.
#
# Build from the repo root (context must be the repo root because the
# Dockerfile copies from `src/` and `config/`):
#
#   docker build -f docker/Dockerfile -t emby-utils-mcp:dev .
#
# Or via the npm script wrappers:
#   npm run docker:build
#   npm run docker:up     # docker compose up -d
#   npm run docker:down
#
# The server runs HTTP/SSE on port 3000:
#   docker run --rm -p 3000:3000 \
#     -e EMBY_HOST=... -e EMBY_API_KEY=... \
#     ghcr.io/vromero/emby-utils-mcp
#
# `@emby-utils/client` is declared in package.json as a GitHub dependency
# (`github:vromero/emby-utils-client#main`). npm clones and builds it during
# install via the client's `prepare` script, so no pre-packed tarball or
# registry publish is required.
#
# Ignore file: `docker/Dockerfile.dockerignore` (BuildKit picks it up
# automatically when building with `-f docker/Dockerfile`).

############################################
# Stage 1: build (TypeScript -> dist/)
############################################
FROM node:22-alpine AS build

# `git` is needed so npm can clone the `@emby-utils/client` GitHub
# dependency; Alpine doesn't ship it in the base image.
RUN apk add --no-cache git

WORKDIR /app

# Skip husky's prepare in every `npm install` run below. husky v9 already
# short-circuits when there is no `.git/` dir (the error message is
# harmless), but setting HUSKY=0 makes the skip explicit and avoids noise.
ENV HUSKY=0

# Install deps first so the layer caches independently of source changes.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy configs + sources, then compile.
COPY config/tsconfig.json config/tsconfig.build.json ./config/
COPY src ./src
RUN npm run build

# Prune dev deps so only production dependencies remain in node_modules/.
RUN npm prune --omit=dev

############################################
# Stage 2: runtime (minimal image)
############################################
FROM node:22-alpine AS runtime

# Labels for GHCR discoverability.
LABEL org.opencontainers.image.source="https://github.com/vromero/emby-utils-mcp"
LABEL org.opencontainers.image.description="Model Context Protocol (MCP) server for Emby (HTTP/SSE)."
LABEL org.opencontainers.image.licenses="MIT"

# Don't run Node as root.
USER node

WORKDIR /home/node/app

# Copy only what's needed at runtime.
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/package.json ./package.json

ENV NODE_ENV=production \
    EMBY_MCP_HOST=0.0.0.0 \
    EMBY_MCP_PORT=3000

EXPOSE 3000

# Healthcheck hits /healthz on the HTTP server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.EMBY_MCP_PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# HTTP/SSE on 0.0.0.0:3000.
CMD ["node", "dist/bin.js"]
