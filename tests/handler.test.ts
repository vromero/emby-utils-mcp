import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { EmbyClient } from "@emby-utils/client";
import { EmbyMcpHandler } from "../src/handler.js";
import { EMBY_API_KEY, EMBY_HOST, server } from "./setup.js";
import "./setup.js";

function makeHandler() {
  const client = new EmbyClient(EMBY_HOST, EMBY_API_KEY);
  return new EmbyMcpHandler(client);
}

function unwrap<T = any>(res: { content: { text: string }[]; isError?: boolean }): T {
  return JSON.parse(res.content[0].text) as T;
}

describe("EmbyMcpHandler - semantic wrappers", () => {
  it("getServerInfo returns system info", async () => {
    const h = makeHandler();
    const res = await h.getServerInfo();
    expect(res.isError).toBeUndefined();
    expect(unwrap(res).ServerName).toBe("Test Emby");
  });

  it("getPublicServerInfo returns public info", async () => {
    const h = makeHandler();
    const res = await h.getPublicServerInfo();
    expect(unwrap(res).ServerName).toBe("Test Emby");
  });

  it("listMedia forwards UserId when provided", async () => {
    const h = makeHandler();
    const res = await h.listMedia({ userId: "user-1" });
    expect(unwrap(res)._query.UserId).toBe("user-1");
  });

  it("listMedia works without a user", async () => {
    const h = makeHandler();
    const res = await h.listMedia();
    expect(unwrap(res).Items).toHaveLength(2);
  });

  it("searchMedia sets SearchTerm and Limit", async () => {
    const h = makeHandler();
    const res = await h.searchMedia({ query: "matrix", limit: 10 });
    const q = unwrap(res)._query;
    expect(q.SearchTerm).toBe("matrix");
    expect(q.Limit).toBe("10");
  });

  it("getItemDetails uses the user-scoped route", async () => {
    const h = makeHandler();
    const res = await h.getItemDetails({ id: "item-1", userId: "user-1" });
    expect(unwrap(res).Name).toContain("User user-1 scoped item item-1");
  });

  it("listUsers returns the users array", async () => {
    const h = makeHandler();
    const res = await h.listUsers();
    const data = unwrap<any[]>(res);
    expect(data).toHaveLength(2);
    expect(data[0].Name).toBe("alice");
  });

  it("getUserDetails returns a single user", async () => {
    const h = makeHandler();
    const res = await h.getUserDetails({ userId: "user-1" });
    expect(unwrap(res).Id).toBe("user-1");
  });

  it("getSessions, listLibraries, getPlugins return their data", async () => {
    const h = makeHandler();
    expect(unwrap<any[]>(await h.getSessions())[0].Id).toBe("s1");
    expect(unwrap<any[]>(await h.listLibraries())[0].Name).toBe("Movies");
    expect(unwrap<any[]>(await h.getPlugins())[0].Name).toBe("Test Plugin");
  });
});

describe("EmbyMcpHandler - invoke dispatcher", () => {
  it("dispatches any operationId through invoke()", async () => {
    const h = makeHandler();
    const res = await h.invoke({
      operationId: "getItems",
      queryParams: { SearchTerm: "x" },
    });
    expect(unwrap(res)._query.SearchTerm).toBe("x");
  });

  it("returns an MCP error response on unknown operationId with suggestions", async () => {
    const h = makeHandler();
    const res = await h.invoke({ operationId: "getUsr" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Unknown operationId.*Did you mean.*getUsers/);
  });

  it("returns an MCP error response on missing required path param", async () => {
    const h = makeHandler();
    const res = await h.invoke({ operationId: "getUsersById" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Missing required path parameter/);
  });

  it("rejects unknown path parameters with a helpful message", async () => {
    const h = makeHandler();
    const res = await h.invoke({
      operationId: "getUsersById",
      pathParams: { Id: "u1", Nonsense: "x" },
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Unknown path parameter 'Nonsense'/);
  });

  it("rejects unknown query parameters in strict mode", async () => {
    const h = makeHandler();
    const res = await h.invoke({
      operationId: "getItems",
      queryParams: { TotallyMadeUp: "x" },
      strict: true,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Unknown query parameter 'TotallyMadeUp'/);
  });

  it("permits unknown query params in permissive mode (Emby spec is incomplete)", async () => {
    const h = makeHandler();
    const res = await h.invoke({
      operationId: "getItems",
      queryParams: { TotallyMadeUp: "x" },
    });
    expect(res.isError).toBeUndefined();
  });

  it("returns an MCP error response on HTTP failure", async () => {
    server.use(
      http.get(`${EMBY_HOST}/emby/System/Info`, () => HttpResponse.json({}, { status: 500 }))
    );
    const h = makeHandler();
    const res = await h.getServerInfo();
    expect(res.isError).toBe(true);
  });
});

describe("EmbyMcpHandler - registry helpers", () => {
  it("listOperations returns every operation by default", async () => {
    const h = makeHandler();
    const res = await h.listOperations();
    const data = unwrap<any[]>(res);
    expect(data.length).toBe(447);
  });

  it("listOperations filters by tag", async () => {
    const h = makeHandler();
    const res = await h.listOperations({ tag: "UserService" });
    const data = unwrap<any[]>(res);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((o) => o.tag === "UserService")).toBe(true);
  });

  it("listOperations filters by substring search", async () => {
    const h = makeHandler();
    const res = await h.listOperations({ search: "plugin" });
    const data = unwrap<any[]>(res);
    expect(
      data.every((o) => `${o.operationId} ${o.summary} ${o.path}`.toLowerCase().includes("plugin"))
    ).toBe(true);
  });

  it("describeOperation returns the spec", async () => {
    const h = makeHandler();
    const res = await h.describeOperation({ operationId: "getSystemInfo" });
    const spec = unwrap(res);
    expect(spec.method).toBe("GET");
    expect(spec.path).toBe("/System/Info");
  });

  it("describeOperation reports an error for unknown id", async () => {
    const h = makeHandler();
    const res = await h.describeOperation({ operationId: "nope" });
    expect(res.isError).toBe(true);
  });
});

describe("EmbyMcpHandler - rawRequest", () => {
  it("performs a raw GET through the handler", async () => {
    server.use(http.get(`${EMBY_HOST}/emby/Custom/Thing`, () => HttpResponse.json({ ok: 1 })));
    const h = makeHandler();
    const res = await h.rawRequest({ method: "GET", endpoint: "/Custom/Thing" });
    expect(unwrap(res).ok).toBe(1);
  });

  it("reports HTTP errors as MCP errors", async () => {
    server.use(
      http.get(`${EMBY_HOST}/emby/Custom/Thing`, () => HttpResponse.json({}, { status: 404 }))
    );
    const h = makeHandler();
    const res = await h.rawRequest({ method: "GET", endpoint: "/Custom/Thing" });
    expect(res.isError).toBe(true);
  });
});
