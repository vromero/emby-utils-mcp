import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EmbyClient } from "@emby-utils/client";
import { EmbyMcpHandler } from "./handler.js";

export { EmbyMcpHandler } from "./handler.js";
export type { McpTextContent, McpToolResponse } from "./handler.js";

/**
 * Build a configured MCP server. Exported as a separate function from the
 * HTTP bootstrap so tests can exercise the wiring without starting a
 * listener.
 */
export function createServer(handler: EmbyMcpHandler): McpServer {
  const server = new McpServer({
    name: "Emby MCP Server",
    version: "0.1.0",
  });

  // --- Semantic, high-traffic tools ---
  server.tool(
    "get_server_info",
    "Get authenticated system information about the Emby server.",
    {},
    async () => handler.getServerInfo()
  );

  server.tool(
    "get_public_server_info",
    "Get public system information about the Emby server (no auth required).",
    {},
    async () => handler.getPublicServerInfo()
  );

  server.tool(
    "list_media",
    "List media items. Optionally filter by user.",
    { userId: z.string().optional() },
    async (args) => handler.listMedia(args)
  );

  server.tool(
    "search_media",
    "Full-text search across media items.",
    {
      query: z.string(),
      userId: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    async (args) => handler.searchMedia(args)
  );

  server.tool(
    "get_item_details",
    "Get a specific media item by ID in the context of a user (Emby exposes item details only in the user-scoped route).",
    { id: z.string(), userId: z.string() },
    async (args) => handler.getItemDetails(args)
  );

  server.tool("list_users", "List all Emby users.", {}, async () => handler.listUsers());

  server.tool(
    "get_user_details",
    "Get a single user's details.",
    { userId: z.string() },
    async (args) => handler.getUserDetails(args)
  );

  server.tool("get_sessions", "List active client sessions.", {}, async () =>
    handler.getSessions()
  );
  server.tool("list_libraries", "List virtual folders (libraries).", {}, async () =>
    handler.listLibraries()
  );
  server.tool("get_plugins", "List installed Emby plugins.", {}, async () => handler.getPlugins());

  // --- Universal dispatcher ---
  server.tool(
    "emby_list_operations",
    "List Emby API operations. Filter with `tag` (service name) or `search` (substring match on id/summary/path).",
    { tag: z.string().optional(), search: z.string().optional() },
    async (args) => handler.listOperations(args)
  );

  server.tool(
    "emby_describe_operation",
    "Describe an Emby API operation: its HTTP method, path, and required/optional parameters.",
    { operationId: z.string() },
    async (args) => handler.describeOperation(args)
  );

  server.tool(
    "emby_invoke",
    "Invoke any Emby API operation by its operationId. Use `emby_list_operations` / `emby_describe_operation` to discover valid ids and their parameters. Pass `strict: true` to reject unknown query params and type mismatches.",
    {
      operationId: z.string(),
      pathParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      queryParams: z.record(z.string(), z.any()).optional(),
      body: z.any().optional(),
      strict: z.boolean().optional(),
    },
    async (args) => handler.invoke(args)
  );

  server.tool(
    "emby_raw_request",
    "Escape hatch: make a raw HTTP call to any Emby endpoint not covered by the registry.",
    {
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]),
      endpoint: z.string(),
      body: z.any().optional(),
      queryParams: z.record(z.string(), z.any()).optional(),
    },
    async (args) => handler.rawRequest(args)
  );

  return server;
}

/** Convenience: build server + client + handler from a host/apiKey pair. */
export function createServerFromConfig(config: { host: string; apiKey: string }): {
  server: McpServer;
  client: EmbyClient;
  handler: EmbyMcpHandler;
} {
  const client = new EmbyClient(config.host, config.apiKey);
  const handler = new EmbyMcpHandler(client);
  const server = createServer(handler);
  return { server, client, handler };
}
