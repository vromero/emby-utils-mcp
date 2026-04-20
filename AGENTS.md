# Agent Guidelines — @emby-utils/server

## What this repo is

Standalone npm package `@emby-utils/server`. An MCP (Model Context Protocol) server that exposes the full Emby API to MCP-capable LLM clients over **HTTP / Streamable HTTP with SSE** (no stdio transport). Binary: `emby-mcp-server` (`src/bin.ts`). Listens on `0.0.0.0:3000` by default.

Depends on `@emby-utils/client` from the npm registry (published from `vromero/emby-utils-client`). A sibling CLI package ships from `vromero/emby-utils-cli`.

The `emby-mcp-server` binary name intentionally keeps the `mcp` marker so users can tell what protocol the service speaks; the npm package is scoped under `@emby-utils/`.

Also shipped as an OCI image: `ghcr.io/vromero/emby-utils-mcp:<tag>`, multi-arch (amd64 + arm64). Docker assets live under `docker/`: `Dockerfile`, `Dockerfile.dockerignore`, `docker-compose.yml`, `.env.example`. Publish workflow is `.github/workflows/docker-publish.yml`.

## Repository layout

Tooling and ops configs are grouped under subdirectories to keep the root lean:

| Path             | Contents                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/`           | TypeScript sources. Entry is `src/bin.ts`.                                                                                |
| `tests/`         | Vitest suite. MSW setup in `tests/setup.ts`; host/key constants in `tests/constants.ts`.                                  |
| `config/`        | `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `prettier.config.mjs`, `.prettierignore`, `vitest.config.ts`. |
| `docker/`        | `Dockerfile`, `Dockerfile.dockerignore`, `docker-compose.yml`, `.env.example`, `README.md`.                               |
| `.config/husky/` | Pre-commit hook. Husky is wired via `"prepare": "husky .config/husky"` in `package.json`.                                 |
| `.changeset/`    | Changesets metadata (tool-locked path).                                                                                   |
| `.github/`       | CI + release workflows (tool-locked path).                                                                                |

All `npm` scripts invoke the underlying tools with explicit `-c` / `-p` / `--config` flags pointing at `config/`, so the indirection is invisible to contributors.

### Why the non-standard layout for tooling

- No root-level `tsconfig.json`. IDEs that auto-detect TypeScript projects need to be pointed at `config/tsconfig.json` (VS Code: set `"typescript.tsconfigPath"` per-workspace).
- No root-level `.prettierrc.*`. Editor Prettier integrations either need `--config config/prettier.config.mjs` or a workspace-level setting. CLI calls work because npm scripts pass `--config` explicitly.
- `Dockerfile.dockerignore` is BuildKit's per-Dockerfile ignore convention (Docker 23+). BuildKit auto-picks it when you run `docker build -f docker/Dockerfile`. No separate flag needed.
- `docker compose` is always invoked from the repo root with `-f docker/docker-compose.yml --project-directory docker`, so the compose file can reference a local `.env` via its own directory and builds get the repo-root context they need.

## Setup & Environment

- ESM-only (`"type": "module"`). Use `.js` extensions in relative TypeScript imports (NodeNext resolution).
- Node >=22.13 (enforced in `engines`).
- Required env at runtime: `EMBY_HOST` + `EMBY_API_KEY`. The bin auto-loads `.env` from CWD if present. Override path with `EMBY_ENV_FILE`.
- Bind configuration: `EMBY_MCP_HOST` (default `0.0.0.0`), `EMBY_MCP_PORT` (default `3000`).

## Commands

- `npm install` — deps. Runs `husky .config/husky` via the `prepare` script to wire the Git hook dir to `.config/husky/`.
- `npm run build` — `tsc -p config/tsconfig.build.json`.
- `npm start` — runs the compiled HTTP server (`dist/bin.js`).
- `npm test` — `vitest run --config config/vitest.config.ts`. The config file sets `root: ".."` so Vitest resolves `tests/**/*.test.ts` at the repo root.
- `npm run lint` / `lint:fix` — ESLint via `-c config/eslint.config.js`.
- `npm run format` / `format:check` — Prettier via `--config config/prettier.config.mjs --ignore-path config/.prettierignore`.
- `npm run docker:build` — `docker build -f docker/Dockerfile -t emby-utils-mcp:dev .`.
- `npm run docker:up` / `docker:down` — wraps `docker compose -f docker/docker-compose.yml --project-directory docker ...`.
- `npm run release:dry` — preview publish.

## Architecture

- `src/bin.ts` — HTTP entrypoint. Reads env, calls `startHttpServer()`, handles SIGTERM/SIGINT shutdown. This is the **only** binary; there is no stdio transport.
- `src/http.ts` — `startHttpServer({ host, apiKey, bindHost?, port? })`. Creates the MCP server, wraps `StreamableHTTPServerTransport` in stateless mode (`sessionIdGenerator: undefined`), exposes `GET /mcp`, `POST /mcp`, `GET /healthz`. Returns `{ httpServer, port, bindHost, close }`.
- `src/index.ts` — exports `createServer(handler)` and `createServerFromConfig({host, apiKey})`. Keeps the server construction testable.
- `src/handler.ts` — `EmbyMcpHandler` facade composing per-domain handlers and keeping a flat back-compat API (`getServerInfo`, `listMedia`, etc.).
- `src/handlers/{system,users,items,sessions,libraries,plugins,registry}.ts` — per-domain handlers; `base.ts` provides shared ok/fail serialization.
- `registry.ts` exposes `emby_invoke`, `emby_list_operations`, `emby_describe_operation`, `emby_raw_request`. `emby_invoke` validates path params strictly and query params permissively (Emby's spec is incomplete for many query params); pass `strict: true` to make them errors. Unknown operationIds get Levenshtein-based suggestions.

## Quirks

- **No `GET /Items/{Id}`** — Emby only exposes item details via `GET /Users/{UserId}/Items/{Id}` (`getUsersByUseridItemsById`). `getItemDetails` therefore requires a `userId`.
- `tests/mcp-server.test.ts` reaches into `McpServer._registeredTools` (private). If the SDK changes its internals, update this test rather than deleting it.
- `tests/http.test.ts` **does not** import `./setup.js`. The MSW server registered there has `onUnhandledRequest: "error"` and would reject the real fetches the test issues to our own loopback HTTP server. The HTTP tests only exercise endpoints that never touch Emby (`/healthz`, MCP `initialize`), so MSW isn't needed.
- `StreamableHTTPServerTransport` is run in **stateless** mode (`sessionIdGenerator: undefined`). No in-memory session state, so the container scales horizontally without sticky sessions.
- The Dockerfile sets `HUSKY=0` so the husky `prepare` script skip is explicit; without it, husky v9 also short-circuits silently because there's no `.git/` dir in the image, but the env var removes the reliance on that quirk.

## Cross-repo development

To test against local, unreleased `@emby-utils/client` changes, point the dependency at a local path or GitHub ref instead of the published version:

```bash
# Local checkout:
npm install --save ../emby-utils-client

# Unpublished GitHub branch:
npm install --save "github:vromero/emby-utils-client#some-branch"

# When done, restore the npm version:
npm install --save "@emby-utils/client@^0.1.0"
```

Alternatively, `npm link` works for a symlink-based workflow.

## Testing

- **Framework**: Vitest 4.x. MSW 2.x (`setupServer` from `msw/node`) mocks Emby HTTP.
- `tests/setup.ts`, `tests/msw-handlers.ts`, `tests/constants.ts`. Constants are in a separate file to avoid circular imports between setup and handlers.
- `onUnhandledRequest: "error"` — every outbound request must be handled. When adding tests for new endpoints, register a handler via `server.use(...)` inside the test.

## Publishing

- Published to npm as `@emby-utils/server` (scope-public). `publishConfig.access: "public"` in `package.json`.
- A `prepack` script runs `npm run build` so `npm publish` (or `npm pack`) always ships a fresh `dist/`.
- Flow: bump `version` in `package.json`, `npm run release:dry` to preview the tarball contents, `npm run release` to publish. Finally tag `vX.Y.Z` in git and push to trigger `.github/workflows/docker-publish.yml`.

## CI

- `.github/workflows/ci.yml` — lint, format check, build, test on Node `22.13.x`, `22.x`, and `latest`.
- `.github/workflows/docker-publish.yml` — runs on `v*` git tags. Builds a multi-arch (amd64 + arm64) image via buildx and pushes to `ghcr.io/vromero/emby-utils-mcp`. Uses `docker/metadata-action` to produce semver + `latest` + `sha-<full>` tags. Caches layers via GitHub Actions cache.
