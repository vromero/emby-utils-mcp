import { BaseHandler, McpToolResponse } from "./base.js";

export class UsersHandler extends BaseHandler {
  async list(): Promise<McpToolResponse> {
    return this.safeCall(() => this.emby.callOperation("getUsers"));
  }

  async get(args: { userId: string }): Promise<McpToolResponse> {
    return this.safeCall(() =>
      this.emby.callOperation("getUsersById", { pathParams: { Id: args.userId } })
    );
  }
}
