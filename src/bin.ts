#!/usr/bin/env node
/**
 * HTTP/SSE entry point for the Emby MCP server.
 *
 * Reads EMBY_HOST and EMBY_API_KEY from the environment (or an auto-loaded
 * `.env` file in CWD). Binding defaults to `0.0.0.0:3000` so the container
 * is reachable by default; override with EMBY_MCP_HOST / EMBY_MCP_PORT.
 *
 * Endpoints:
 *   GET  /mcp      - SSE stream for server-initiated messages
 *   POST /mcp      - Client-to-server JSON-RPC
 *   GET  /healthz  - `{"status":"ok"}` for container healthchecks
 */
import { startHttpServer } from "./http.js";
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
  const bindHost = process.env.EMBY_MCP_HOST ?? "0.0.0.0";
  const portRaw = process.env.EMBY_MCP_PORT ?? "3000";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Invalid EMBY_MCP_PORT: ${portRaw}`);
    process.exit(1);
  }

  const started = await startHttpServer({ host, apiKey, bindHost, port });
  console.error(
    `Emby MCP Server listening on http://${started.bindHost}:${started.port} (MCP: /mcp, health: /healthz)`
  );

  const shutdown = (signal: string) => {
    console.error(`Received ${signal}, shutting down...`);
    started
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Error during shutdown:", err);
        process.exit(1);
      });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
