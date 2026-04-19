import { BaseHandler, McpToolResponse } from "./base.js";

export class PluginsHandler extends BaseHandler {
  async list(): Promise<McpToolResponse> {
    return this.safeCall(() => this.emby.callOperation("getPlugins"));
  }
}
