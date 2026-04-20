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
as the build context**. The Dockerfile copies sources from `src/` and
tsconfigs from `config/`.

```bash
# From the repo root:
docker build -f docker/Dockerfile -t emby-utils-mcp:dev .

# Compose shortcuts from the repo root (see package.json scripts):
npm run docker:build
npm run docker:up      # docker compose -f docker/docker-compose.yml ... up -d
npm run docker:down    # docker compose -f docker/docker-compose.yml ... down
```

## About the `@emby-utils/client` dependency

`@emby-utils/client` is pulled directly from its GitHub repo
(`github:vromero/emby-utils-client#main`) rather than from the npm registry.
The client's own `prepare` script compiles it to `dist/` during `npm install`,
so consumers — including this Dockerfile — get a ready-to-use package without
any extra tooling. `git` is added to the build stage (Alpine doesn't ship it
by default) so npm can clone the dep.
