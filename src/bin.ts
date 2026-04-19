#!/usr/bin/env node
/**
 * stdio entry point for the Emby MCP server.
 * Reads EMBY_HOST and EMBY_API_KEY from the environment. Supports a local
 * `.env` file (auto-loaded if present in the current working directory)
 * or an explicit path via `EMBY_ENV_FILE=/path/to/.env`.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServerFromConfig } from "./index.js";
import { loadEnv } from "./env.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  loadEnv();
  const host = requireEnv("EMBY_HOST");
  const apiKey = requireEnv("EMBY_API_KEY");
  const { server } = createServerFromConfig({ host, apiKey });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Emby MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
