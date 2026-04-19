/**
 * HTTP transport bootstrap tests.
 *
 * We start the real HTTP server against an ephemeral port (0 = let the OS
 * pick one), exercise /healthz and an MCP initialize request over /mcp,
 * then shut it down.
 *
 * Notably this file does NOT import `./setup.js`: the MSW server registered
 * there has `onUnhandledRequest: "error"` and would reject the real fetches
 * we issue to our own loopback HTTP server. Since these tests don't exercise
 * any Emby-bound traffic (the MCP `initialize` handshake is handled entirely
 * inside the SDK), we skip the MSW setup for this file.
 */
import { afterEach, describe, expect, it } from "vitest";
import { startHttpServer, type StartedHttpServer } from "../src/http.js";
import { EMBY_API_KEY, EMBY_HOST } from "./constants.js";

let started: StartedHttpServer | null = null;

afterEach(async () => {
  if (started) {
    await started.close();
    started = null;
  }
});

async function startEphemeral() {
  started = await startHttpServer({
    host: EMBY_HOST,
    apiKey: EMBY_API_KEY,
    bindHost: "127.0.0.1",
    port: 0,
  });
  return started;
}

describe("HTTP transport", () => {
  it("exposes a healthz endpoint", async () => {
    const s = await startEphemeral();
    const res = await fetch(`http://127.0.0.1:${s.port}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("404s on unknown paths", async () => {
    const s = await startEphemeral();
    const res = await fetch(`http://127.0.0.1:${s.port}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("handles an MCP initialize request over POST /mcp", async () => {
    const s = await startEphemeral();
    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "vitest-http-client", version: "0.0.0" },
      },
    };
    const res = await fetch(`http://127.0.0.1:${s.port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(initialize),
    });
    expect(res.status).toBe(200);
    // The MCP SDK may return JSON or SSE depending on Accept; either is a
    // successful handshake from the transport's perspective.
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toMatch(/application\/json|text\/event-stream/);
    const text = await res.text();
    expect(text).toContain("jsonrpc");
    // The handshake response should reference the initialize id and report
    // the server's advertised capabilities/name.
    expect(text).toContain('"id":1');
    expect(text).toContain("Emby MCP Server");
  });

  it("reports the effective bound port and host", async () => {
    const s = await startEphemeral();
    expect(s.bindHost).toBe("127.0.0.1");
    expect(s.port).toBeGreaterThan(0);
  });
});
