/**
 * HTTP transport for the Emby MCP server.
 *
 * Uses the MCP SDK's `StreamableHTTPServerTransport` in **stateless mode** so
 * each request is independent and the container can be scaled horizontally
 * without sticky sessions. Stateless mode also means no in-memory session
 * state to grow unbounded across long-lived Docker runs.
 *
 * Endpoints:
 *   GET  /mcp      - SSE stream for server-initiated messages
 *   POST /mcp      - Client-to-server JSON-RPC (MCP Streamable HTTP spec)
 *   GET  /healthz  - 200 `{"status":"ok"}` for container healthchecks
 *
 * Binding defaults to `0.0.0.0:3000` so the container is reachable by default.
 * Override with EMBY_MCP_HOST / EMBY_MCP_PORT.
 */
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { EmbyClient } from "@emby-utils/client";
import { EmbyMcpHandler } from "./handler.js";
import { createServer as createMcpServer } from "./index.js";

export interface HttpServerOptions {
  host: string;
  apiKey: string;
  /** HTTP bind address. Default `0.0.0.0` (suitable for containers). */
  bindHost?: string;
  /** HTTP port. Default `3000`. */
  port?: number;
}

export interface StartedHttpServer {
  /** Underlying Node HTTP server. */
  httpServer: HttpServer;
  /** Effective port the server is listening on (useful when `port: 0`). */
  port: number;
  /** Effective host. */
  bindHost: string;
  /** Stops the HTTP server and the underlying MCP transport. */
  close: () => Promise<void>;
}

/**
 * Build and start the HTTP/SSE MCP server. Returns once the listener is open.
 */
export async function startHttpServer(options: HttpServerOptions): Promise<StartedHttpServer> {
  const bindHost = options.bindHost ?? "0.0.0.0";
  const port = options.port ?? 3000;

  const client = new EmbyClient(options.host, options.apiKey);
  const handler = new EmbyMcpHandler(client);
  const server = createMcpServer(handler);

  // Stateless mode: each request is independent. `sessionIdGenerator: undefined`
  // is the documented way to opt into statelessness.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  const httpServer = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (url.pathname === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (url.pathname === "/mcp") {
        // For POST, buffer the body so the transport sees pre-parsed JSON.
        if (req.method === "POST") {
          const body = await readJsonBody(req);
          await transport.handleRequest(req, res, body);
        } else {
          await transport.handleRequest(req, res);
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: msg }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, bindHost, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  const addr = httpServer.address();
  const effectivePort = typeof addr === "object" && addr !== null ? addr.port : port;

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    await transport.close();
  };

  return {
    httpServer,
    port: effectivePort,
    bindHost,
    close,
  };
}

/** Read a JSON body from an incoming HTTP request. */
async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // Let the transport decide what to do with a malformed body.
    return text;
  }
}
