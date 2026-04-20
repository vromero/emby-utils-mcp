# docker/

Docker build + runtime assets for `@emby-utils/server`.

| File                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `Dockerfile`              | Multi-stage build producing `ghcr.io/vromero/emby-utils-mcp`.                   |
| `Dockerfile.dockerignore` | Build-context ignore list. BuildKit auto-picks when `-f docker/Dockerfile`.     |
| `docker-compose.yml`      | One-service compose file for running the image locally.                         |
| `.env.example`            | Template for the env vars the compose file reads (`EMBY_HOST`, `EMBY_API_KEY`). |

## Build / run

All `docker build` and `docker compose` invocations run with the **repo root
as the build context**. The Dockerfile copies sources from `src/`, tsconfigs
from `config/`, and optional tarballs from `local/`.

```bash
# From the repo root:
docker build -f docker/Dockerfile -t emby-utils-mcp:dev .

# Compose shortcuts from the repo root (see package.json scripts):
npm run docker:up      # docker compose -f docker/docker-compose.yml ... up -d
npm run docker:down    # docker compose -f docker/docker-compose.yml ... down
```

## Staging local client builds

Before `@emby-utils/client` is on npm, pack it and drop the tarball in
`local/` at the repo root, then pass its path via `CLIENT_TARBALL`:

```bash
# In the client repo:
npm run build && npm pack
mv emby-utils-client-*.tgz ../emby-utils-mcp/local/

# In this repo:
docker build \
  -f docker/Dockerfile \
  --build-arg CLIENT_TARBALL=local/emby-utils-client-0.1.0.tgz \
  -t emby-utils-mcp:dev .
```
