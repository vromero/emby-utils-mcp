# Agent Guidelines — @emby-utils/server

## What this repo is

Standalone npm package `@emby-utils/server`. An MCP (Model Context Protocol) server that exposes the full Emby API to MCP-capable LLM clients over **HTTP / Streamable HTTP with SSE** (no stdio transport). Binary: `emby-mcp-server` (`src/bin.ts`). Listens on `0.0.0.0:3000` by default.

Depends on the separately-published `@emby-utils/client` (GitHub: `vromero/emby-utils-client`). A sibling CLI package ships from `vromero/emby-utils-cli`.

The `emby-mcp-server` binary name intentionally keeps the `mcp` marker so users can tell what protocol the service speaks; the npm package is scoped under `@emby-utils/`.

Also shipped as an OCI image: `ghcr.io/vromero/emby-utils-mcp:<tag>`, multi-arch (amd64 + arm64). See `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.github/workflows/docker-publish.yml`.

## Setup & Environment

- ESM-only (`"type": "module"`). Use `.js` extensions in relative TypeScript imports (NodeNext resolution).
- Node >=22.13 (enforced in `engines`).
- Required env at runtime: `EMBY_HOST` + `EMBY_API_KEY`. The bin auto-loads `.env` from CWD if present. Override path with `EMBY_ENV_FILE`.
- Bind configuration: `EMBY_MCP_HOST` (default `0.0.0.0`), `EMBY_MCP_PORT` (default `3000`).

## Commands

- `npm install` — deps.
- `npm run build` — `tsc -p tsconfig.build.json`.
- `npm start` — runs the compiled HTTP server (`dist/bin.js`).
- `npm test` — Vitest.
- `npm run lint` / `lint:fix`, `npm run format` / `format:check`.
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
- The Dockerfile accepts a `CLIENT_TARBALL` build-arg that points at a file inside the build context (staged under `docker/`). Used to build the image against a locally-packed `@emby-utils/client` before it is published to npm. Once published, the arg can be omitted and the Dockerfile resolves the dep from the registry.

## Cross-repo development

To test against an unreleased `@emby-utils/client`:

```bash
# In the emby-utils-client clone:
npm run build
npm link

# Here:
npm link @emby-utils/client
```

Unlink with `npm unlink --global @emby-utils/client`.

## Testing

- **Framework**: Vitest 4.x. MSW 2.x (`setupServer` from `msw/node`) mocks Emby HTTP.
- `tests/setup.ts`, `tests/msw-handlers.ts`, `tests/constants.ts`. Constants are in a separate file to avoid circular imports between setup and handlers.
- `onUnhandledRequest: "error"` — every outbound request must be handled. When adding tests for new endpoints, register a handler via `server.use(...)` inside the test.

## Publishing

- `publishConfig.access: "public"`. Versioning via **changesets**.
- Flow: `npx changeset` → describe → `npm run version` → `npm run release:dry` → `npm run release`.

## CI

- `.github/workflows/ci.yml` — lint, format check, build, test on Node `22.13.x`, `22.x`, and `latest`.
- `.github/workflows/docker-publish.yml` — runs on `v*` git tags. Builds a multi-arch (amd64 + arm64) image via buildx and pushes to `ghcr.io/vromero/emby-utils-mcp`. Uses `docker/metadata-action` to produce semver + `latest` + `sha-<full>` tags. Caches layers via GitHub Actions cache.
