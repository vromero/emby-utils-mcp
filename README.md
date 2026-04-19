# @emby-utils/server

[Model Context Protocol](https://modelcontextprotocol.io) server for the
[Emby](https://emby.media/) REST API. Exposes every one of Emby's 447 operations
to an MCP-capable LLM (Claude Desktop, LM Studio, Continue, etc.) through a
mix of **semantic tools** for common tasks and a **universal dispatcher** for
everything else.

The server speaks MCP over **HTTP (Streamable HTTP + SSE)** on port 3000 —
a long-running service that any MCP client supporting the Streamable HTTP
transport can connect to.

## Quick start — Docker Compose

```bash
git clone https://github.com/vromero/emby-utils-mcp
cd emby-utils-mcp
cp .env.example .env    # fill in EMBY_HOST and EMBY_API_KEY
docker compose up -d
curl http://localhost:3000/healthz
# {"status":"ok"}
```

Then point your MCP client at `http://localhost:3000/mcp`.

## Quick start — Docker run

```bash
docker run -d --name emby-mcp \
  -p 3000:3000 \
  -e EMBY_HOST=http://emby.local:8096 \
  -e EMBY_API_KEY=your-api-key \
  --restart unless-stopped \
  ghcr.io/vromero/emby-utils-mcp:latest
```

## Quick start — Node

```bash
npm install -g @emby-utils/server
EMBY_HOST=http://emby.local:8096 \
EMBY_API_KEY=your-api-key \
  emby-mcp-server
# Emby MCP Server listening on http://0.0.0.0:3000 (MCP: /mcp, health: /healthz)
```

## Configuration

Environment variables:

| Variable        | Default    | Description                                     |
| --------------- | ---------- | ----------------------------------------------- |
| `EMBY_HOST`     | _required_ | Emby server URL (e.g. `http://emby.local:8096`) |
| `EMBY_API_KEY`  | _required_ | Emby API key                                    |
| `EMBY_MCP_HOST` | `0.0.0.0`  | Bind address                                    |
| `EMBY_MCP_PORT` | `3000`     | Bind port                                       |
| `EMBY_ENV_FILE` | `./.env`   | Optional path to a `.env` file to auto-load     |

## Endpoints

| Path       | Method | Purpose                                  |
| ---------- | ------ | ---------------------------------------- |
| `/mcp`     | GET    | SSE stream for server-initiated messages |
| `/mcp`     | POST   | Client-to-server JSON-RPC                |
| `/healthz` | GET    | Health probe (`{"status":"ok"}`)         |

Runs in **stateless mode** (`sessionIdGenerator: undefined`) — no in-memory
session state, so the container scales horizontally without sticky sessions.

## Tools exposed

### Semantic (one tool per common operation)

| Tool                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `get_server_info`        | Authenticated `SystemInfo`               |
| `get_public_server_info` | Unauthenticated public info              |
| `list_media`             | List items (optionally scoped to a user) |
| `search_media`           | Full-text item search                    |
| `get_item_details`       | Get a single item (requires `userId`)    |
| `list_users`             | All users                                |
| `get_user_details`       | Single user                              |
| `get_sessions`           | Active client sessions                   |
| `list_libraries`         | Virtual folders                          |
| `get_plugins`            | Installed plugins                        |

### Universal dispatcher

| Tool                      | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `emby_list_operations`    | List/search operations by tag or keyword                                  |
| `emby_describe_operation` | Inspect a single operation's method, path, and params                     |
| `emby_invoke`             | Call any operation by `operationId` (optionally with `strict` validation) |
| `emby_raw_request`        | Escape-hatch raw HTTP                                                     |

`emby_invoke` validates path params strictly and query params permissively
(Emby's spec is incomplete). Pass `strict: true` to reject unknown query
params and type mismatches.

## Programmatic use

```ts
import { startHttpServer } from "@emby-utils/server/dist/http.js";

const started = await startHttpServer({
  host: process.env.EMBY_HOST!,
  apiKey: process.env.EMBY_API_KEY!,
  port: 3000,
});
// started.close() to shut down.
```

## Docker image

Published to [`ghcr.io/vromero/emby-utils-mcp`](https://github.com/vromero/emby-utils-mcp/pkgs/container/emby-utils-mcp) on every `v*` git tag. Multi-arch (`linux/amd64`, `linux/arm64`).

Tags:

- `latest` — most recent release.
- `vX.Y.Z` / `vX.Y` / `vX` — semver variants for pinning.
- `sha-<full-commit-sha>` — exact build for reproducibility.

## License

MIT
