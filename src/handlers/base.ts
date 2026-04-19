/**
 * Base utilities for building MCP tool handlers.
 * Each domain handler (system, users, items, etc.) extends `BaseHandler` to
 * get consistent ok/fail response shaping.
 */
import { EmbyClient } from "@emby-utils/client";

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResponse {
  content: McpTextContent[];
  isError?: boolean;
  [key: string]: unknown;
}

export abstract class BaseHandler {
  constructor(protected readonly emby: EmbyClient) {}

  protected ok(data: unknown): McpToolResponse {
    const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return { content: [{ type: "text", text }] };
  }

  protected fail(err: unknown): McpToolResponse {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }

  /** Execute a client call and wrap successes/failures uniformly. */
  protected async safeCall<T>(fn: () => Promise<T>): Promise<McpToolResponse> {
    try {
      return this.ok(await fn());
    } catch (err) {
      return this.fail(err);
    }
  }
}
