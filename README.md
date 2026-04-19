# @emby-utils/server

[Model Context Protocol](https://modelcontextprotocol.io) server for the
[Emby](https://emby.media/) REST API. Exposes every one of Emby's 447 operations
to an MCP-capable LLM (Claude Desktop, LM Studio, Continue, etc.) through a
mix of **semantic tools** for common tasks and a **universal dispatcher** for
everything else.

## Install / configure

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

Alternatively, install globally and use the `emby-mcp-server` binary directly.

A local `.env` file in the working directory is auto-loaded if present;
set `EMBY_ENV_FILE=/custom/path/.env` to override.

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

## License

MIT
