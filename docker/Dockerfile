# syntax=docker/dockerfile:1.7
#
# Multi-stage image for @emby-utils/server. The runtime stage is a minimal
# node:22-alpine with only production deps and compiled dist/.
#
# Build from the repo root (context must be the repo root because the
# Dockerfile copies from `src/`, `config/`, and `local/`):
#
#   docker build -f docker/Dockerfile -t emby-utils-mcp:dev .
#
# Or via the npm script wrappers:
#   npm run docker:up     # docker compose up -d
#   npm run docker:down
#
# The server runs HTTP/SSE on port 3000:
#   docker run --rm -p 3000:3000 \
#     -e EMBY_HOST=... -e EMBY_API_KEY=... \
#     ghcr.io/vromero/emby-utils-mcp
#
# Build arg CLIENT_TARBALL (optional): when set, must be a path **inside the
# build context** to a pre-built `@emby-utils/client` .tgz (produced by
# `npm pack` in the client repo). Used for local development before the
# client is published to npm. Default convention is to drop the tarball into
# `local/` at the repo root, e.g.:
#
#   docker build \
#     -f docker/Dockerfile \
#     --build-arg CLIENT_TARBALL=local/emby-utils-client-0.1.0.tgz \
#     -t emby-utils-mcp:dev .
#
# When unset, the build installs `@emby-utils/client` from the registry like
# any other dep.
#
# Ignore file: `docker/Dockerfile.dockerignore` (BuildKit picks it up
# automatically when building with `-f docker/Dockerfile`).

############################################
# Stage 1: build (TypeScript -> dist/)
############################################
FROM node:22-alpine AS build

WORKDIR /app

# Install deps first so the layer caches independently of source changes.
COPY package.json package-lock.json* ./

# Optional local @emby-utils/client tarball. The `local/` directory always
# exists (tracked via .gitkeep) so the COPY never fails. When CLIENT_TARBALL
# is set, we pass it as an explicit install target in the same `npm install`
# that resolves the rest of the deps — this overrides package.json's
# declared spec so npm doesn't try to re-fetch the registry version.
#
# `--ignore-scripts` skips the `prepare` (husky) script which would fail
# inside the image because there is no `.git` dir.
ARG CLIENT_TARBALL=""
COPY local/ ./local/
RUN if [ -n "${CLIENT_TARBALL}" ] && [ -f "./${CLIENT_TARBALL}" ]; then \
      echo "Installing with local @emby-utils/client from ${CLIENT_TARBALL}" && \
      npm install --no-audit --no-fund --ignore-scripts "./${CLIENT_TARBALL}"; \
    else \
      npm install --no-audit --no-fund --ignore-scripts; \
    fi

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
