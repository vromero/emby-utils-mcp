/**
 * Smoke-tests the MCP server wiring. We don't spin a real stdio transport -
 * we just confirm the server builds and the expected tools are registered.
 */
import { describe, it, expect } from "vitest";
import { EmbyClient } from "@emby-utils/client";
import { EmbyMcpHandler } from "../src/handler.js";
import { createServer, createServerFromConfig } from "../src/index.js";
import { EMBY_API_KEY, EMBY_HOST } from "./setup.js";
import "./setup.js";

function build() {
  const c = new EmbyClient(EMBY_HOST, EMBY_API_KEY);
  const h = new EmbyMcpHandler(c);
  return createServer(h);
}

describe("MCP server", () => {
  it("builds without throwing", () => {
    const s = build();
    expect(s).toBeDefined();
  });

  it("createServerFromConfig builds the whole stack", () => {
    const { server, client, handler } = createServerFromConfig({
      host: EMBY_HOST,
      apiKey: EMBY_API_KEY,
    });
    expect(server).toBeDefined();
    expect(client).toBeInstanceOf(EmbyClient);
    expect(handler).toBeInstanceOf(EmbyMcpHandler);
  });

  it("registers the expected semantic and dispatcher tools", () => {
    const s = build();
    // The SDK exposes registered tools via an internal map; reach into it
    // only for assertion purposes. If the SDK changes, this test will fail
    // loudly and we'll switch to a public API.
    const internal = (s as any)._registeredTools as Record<string, unknown> | undefined;
    expect(internal, "expected registered tools map").toBeDefined();
    const toolNames = Object.keys(internal!);
    for (const expected of [
      "get_server_info",
      "get_public_server_info",
      "list_media",
      "search_media",
      "get_item_details",
      "list_users",
      "get_user_details",
      "get_sessions",
      "list_libraries",
      "get_plugins",
      "emby_list_operations",
      "emby_describe_operation",
      "emby_invoke",
      "emby_raw_request",
    ]) {
      expect(toolNames, `tool ${expected} must be registered`).toContain(expected);
    }
  });
});
