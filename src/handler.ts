/**
 * `EmbyMcpHandler` is the facade used by the MCP tool layer. It composes
 * domain-specific handlers (system, users, items, ...) and a generic
 * registry handler so each file stays small while the public surface
 * remains a single object.
 */
import { EmbyClient } from "@emby-utils/client";
import { McpTextContent, McpToolResponse } from "./handlers/base.js";
import { SystemHandler } from "./handlers/system.js";
import { UsersHandler } from "./handlers/users.js";
import { ItemsHandler } from "./handlers/items.js";
import { SessionsHandler } from "./handlers/sessions.js";
import { LibrariesHandler } from "./handlers/libraries.js";
import { PluginsHandler } from "./handlers/plugins.js";
import { RegistryHandler } from "./handlers/registry.js";

export type { McpTextContent, McpToolResponse };

export class EmbyMcpHandler {
  readonly system: SystemHandler;
  readonly users: UsersHandler;
  readonly items: ItemsHandler;
  readonly sessions: SessionsHandler;
  readonly libraries: LibrariesHandler;
  readonly plugins: PluginsHandler;
  readonly registry: RegistryHandler;

  constructor(emby: EmbyClient) {
    this.system = new SystemHandler(emby);
    this.users = new UsersHandler(emby);
    this.items = new ItemsHandler(emby);
    this.sessions = new SessionsHandler(emby);
    this.libraries = new LibrariesHandler(emby);
    this.plugins = new PluginsHandler(emby);
    this.registry = new RegistryHandler(emby);
  }

  // --- Flat convenience API (backwards compatible with earlier versions) ---

  getServerInfo = () => this.system.getServerInfo();
  getPublicServerInfo = () => this.system.getPublicServerInfo();
  listUsers = () => this.users.list();
  getUserDetails = (args: { userId: string }) => this.users.get(args);
  listMedia = (args?: { userId?: string }) => this.items.list(args);
  searchMedia = (args: { query: string; userId?: string; limit?: number }) =>
    this.items.search(args);
  getItemDetails = (args: { id: string; userId: string }) => this.items.get(args);
  getSessions = () => this.sessions.list();
  listLibraries = () => this.libraries.list();
  getPlugins = () => this.plugins.list();

  invoke = (args: {
    operationId: string;
    pathParams?: Record<string, string | number>;
    queryParams?: Record<string, any>;
    body?: any;
    strict?: boolean;
  }) => this.registry.invoke(args);
  rawRequest = (args: {
    method: string;
    endpoint: string;
    body?: any;
    queryParams?: Record<string, any>;
  }) => this.registry.rawRequest(args);
  listOperations = (args: { tag?: string; search?: string } = {}) =>
    this.registry.listOperations(args);
  describeOperation = (args: { operationId: string }) => this.registry.describeOperation(args);
}
