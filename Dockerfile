# syntax=docker/dockerfile:1.7
#
# Multi-stage image for @emby-utils/server. The runtime stage is a minimal
# node:22-alpine with only production deps and compiled dist/.
#
# The server runs HTTP/SSE on port 3000:
#   docker run --rm -p 3000:3000 \
#     -e EMBY_HOST=... -e EMBY_API_KEY=... \
#     ghcr.io/vromero/emby-utils-mcp
#
# Build arg CLIENT_TARBALL (optional): when set, must be a path **inside the
# build context** to a pre-built `@emby-utils/client` .tgz (produced by
# `npm pack` in the client repo). Used for local development before the
# client is published to npm. When unset, the build installs `@emby-utils/client`
# from the registry like any other dep.

############################################
# Stage 1: build (TypeScript -> dist/)
############################################
FROM node:22-alpine AS build

WORKDIR /app

# Install deps first so the layer caches independently of source changes.
COPY package.json package-lock.json* ./

# Optional: path inside the build context to a pre-packed @emby-utils/client
# tarball (produced by `npm pack` in the client repo). When set, it is
# installed first so the subsequent `npm install` resolves the dep locally
# instead of hitting the registry. Used for local development before the
# client is published to npm. The `docker/` dir is used as a staging area
# so `docker build` has a stable, always-existing path to COPY from.
ARG CLIENT_TARBALL=""
COPY docker/ ./docker/
RUN if [ -n "${CLIENT_TARBALL}" ] && [ -f "./${CLIENT_TARBALL}" ]; then \
      echo "Installing local @emby-utils/client from ${CLIENT_TARBALL}" && \
      npm install --no-save "./${CLIENT_TARBALL}"; \
    fi

# `npm install` (not `ci`) so the optional local tarball above is respected.
# For production builds with a clean lockfile and the client published to npm,
# `npm ci` would be equivalent.
RUN npm install --no-audit --no-fund

# Copy sources and compile.
COPY tsconfig.json tsconfig.build.json ./
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
