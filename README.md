# @emby-utils/server

[Model Context Protocol](https://modelcontextprotocol.io) server for the
[Emby](https://emby.media/) REST API. Exposes every one of Emby's 447 operations
to an MCP-capable LLM (Claude Desktop, LM Studio, Continue, etc.) through a
mix of **semantic tools** for common tasks and a **universal dispatcher** for
everything else.

## Install / configure

The server ships two transports:

- **stdio** (default, `emby-mcp-server` binary) — the classic MCP transport.
  One process per client, spawned by the MCP host (Claude Desktop, etc.).
- **HTTP / Streamable HTTP with SSE** (`emby-mcp-server-http` binary or the
  Docker image's default command) — a long-running HTTP server on port 3000
  that multiple clients can share.

### Option A — MCP client launches a local stdio process (npm)

Add to your MCP client's server config. For Claude Desktop this is
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or
`%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```jsonc
{
  "mcpServers": {
    "emby": {
      "command": "npx",
      "args": ["-y", "@emby-utils/server"],
      "env": {
        "EMBY_HOST": "http://emby.local:8096",
        "EMBY_API_KEY": "your-api-key",
      },
    },
  },
}
```

A local `.env` file in the working directory is auto-loaded if present;
set `EMBY_ENV_FILE=/custom/path/.env` to override.

### Option B — MCP client launches a stdio process inside Docker

```jsonc
{
  "mcpServers": {
    "emby": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "EMBY_HOST",
        "-e",
        "EMBY_API_KEY",
        "ghcr.io/vromero/emby-utils-mcp:latest",
        "emby-mcp-server",
      ],
      "env": {
        "EMBY_HOST": "http://emby.local:8096",
        "EMBY_API_KEY": "your-api-key",
      },
    },
  },
}
```

`-i` is mandatory — stdio needs stdin attached. Passing `emby-mcp-server` as
the command overrides the image's default (HTTP mode) to run the stdio bin.

### Option C — Long-running HTTP/SSE server via Docker Compose

```bash
git clone https://github.com/vromero/emby-utils-mcp
cd emby-utils-mcp
cp .env.example .env    # fill in EMBY_HOST and EMBY_API_KEY
docker compose up -d
curl http://localhost:3000/healthz
# {"status":"ok"}
```

The server exposes:

- `GET  /healthz` — JSON `{"status":"ok"}` for healthchecks.
- `GET  /mcp` — SSE stream for server → client messages.
- `POST /mcp` — JSON-RPC from client → server.

Override the bind address with `EMBY_MCP_HOST` (default `0.0.0.0`) and port
with `EMBY_MCP_PORT` (default `3000`).

Any MCP client that speaks the Streamable HTTP transport can then point at
`http://localhost:3000/mcp`.

### Running without Docker

```bash
npm install -g @emby-utils/server
EMBY_HOST=... EMBY_API_KEY=... emby-mcp-server          # stdio
EMBY_HOST=... EMBY_API_KEY=... emby-mcp-server-http     # HTTP on 3000
```

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
import { createServerFromConfig } from "@emby-utils/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const { server } = createServerFromConfig({
  host: process.env.EMBY_HOST!,
  apiKey: process.env.EMBY_API_KEY!,
});
await server.connect(new StdioServerTransport());
```

For HTTP:

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

The default command runs the HTTP/SSE server; override with `emby-mcp-server`
to run stdio.

## License

MIT
