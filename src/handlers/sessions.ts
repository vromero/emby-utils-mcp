import { BaseHandler, McpToolResponse } from "./base.js";

export class SessionsHandler extends BaseHandler {
  async list(): Promise<McpToolResponse> {
    return this.safeCall(() => this.emby.callOperation("getSessions"));
  }
}
