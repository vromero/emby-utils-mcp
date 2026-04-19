# Agent Guidelines — @emby-utils/server

## What this repo is

Standalone npm package `@emby-utils/server` (binary: `emby-mcp-server`). An MCP (Model Context Protocol) server that exposes the full Emby API over stdio to MCP-capable LLM clients. Depends on the separately-published `@emby-utils/client` (GitHub: `vromero/emby-utils-client`). A sibling CLI package ships from `vromero/emby-utils-cli`.

The `emby-mcp-server` binary name intentionally keeps the `mcp` marker so users can tell what protocol the binary speaks; the npm package is scoped under `@emby-utils/`.

## Setup & Environment

- ESM-only (`"type": "module"`). Use `.js` extensions in relative TypeScript imports (NodeNext resolution).
- Node >=22.13 (enforced in `engines`).
- Required env at runtime: `EMBY_HOST` + `EMBY_API_KEY`. The bin auto-loads `.env` from CWD if present. Override path with `EMBY_ENV_FILE`.

## Commands

- `npm install` — deps.
- `npm run build` — `tsc -p tsconfig.build.json`.
- `npm start` — runs the compiled stdio server.
- `npm test` — Vitest.
- `npm run lint` / `lint:fix`, `npm run format` / `format:check`.
- `npm run release:dry` — preview publish.

## Architecture

- `src/bin.ts` — stdio entrypoint. Reads env, wires up client + handler + server, connects the stdio transport.
- `src/index.ts` — exports `createServer(handler)` and `createServerFromConfig({host, apiKey})`. Keeps the server building testable without touching stdio.
- `src/handler.ts` — `EmbyMcpHandler` facade composing per-domain handlers and keeping a flat back-compat API (`getServerInfo`, `listMedia`, etc.).
- `src/handlers/{system,users,items,sessions,libraries,plugins,registry}.ts` — per-domain handlers; `base.ts` provides shared ok/fail serialization.
- `registry.ts` exposes `emby_invoke`, `emby_list_operations`, `emby_describe_operation`, `emby_raw_request`. `emby_invoke` validates path params strictly and query params permissively (Emby's spec is incomplete for many query params); pass `strict: true` to make them errors. Unknown operationIds get Levenshtein-based suggestions.

## Quirks

- **No `GET /Items/{Id}`** — Emby only exposes item details via `GET /Users/{UserId}/Items/{Id}` (`getUsersByUseridItemsById`). `getItemDetails` therefore requires a `userId`.
- `tests/mcp-server.test.ts` reaches into `McpServer._registeredTools` (private). If the SDK changes its internals, update this test rather than deleting it.

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

`.github/workflows/ci.yml` runs lint, format check, build, and test on Node `22.13.x`, `22.x`, and `latest`.
