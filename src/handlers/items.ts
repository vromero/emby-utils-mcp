import { BaseHandler, McpToolResponse } from "./base.js";

export class ItemsHandler extends BaseHandler {
  async list(args: { userId?: string } = {}): Promise<McpToolResponse> {
    return this.safeCall(() =>
      this.emby.callOperation("getItems", {
        queryParams: args.userId ? { UserId: args.userId } : {},
      })
    );
  }

  async search(args: { query: string; userId?: string; limit?: number }): Promise<McpToolResponse> {
    const queryParams: Record<string, any> = { SearchTerm: args.query };
    if (args.userId) queryParams.UserId = args.userId;
    if (args.limit) queryParams.Limit = args.limit;
    return this.safeCall(() => this.emby.callOperation("getItems", { queryParams }));
  }

  /**
   * Emby exposes per-item details only via the user-scoped
   * `GET /Users/{UserId}/Items/{Id}` endpoint, so a `userId` is required.
   */
  async get(args: { id: string; userId: string }): Promise<McpToolResponse> {
    return this.safeCall(() =>
      this.emby.callOperation("getUsersByUseridItemsById", {
        pathParams: { UserId: args.userId, Id: args.id },
      })
    );
  }
}
