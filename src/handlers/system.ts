import { BaseHandler, McpToolResponse } from "./base.js";

export class SystemHandler extends BaseHandler {
  async getServerInfo(): Promise<McpToolResponse> {
    return this.safeCall(() => this.emby.callOperation("getSystemInfo"));
  }

  async getPublicServerInfo(): Promise<McpToolResponse> {
    return this.safeCall(() => this.emby.callOperation("getSystemInfoPublic"));
  }
}
