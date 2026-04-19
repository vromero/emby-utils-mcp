/**
 * Handlers for the generic operation registry: list/describe/invoke/raw.
 * These are how LLMs interact with any of the 447 Emby operations without
 * a purpose-built MCP tool for each one.
 */
import { operations, OperationSpec } from "@emby-utils/client";
import { BaseHandler, McpToolResponse } from "./base.js";

/** Levenshtein distance for nearest-neighbour operationId suggestions. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function suggestOperationIds(input: string, limit = 5): string[] {
  const lower = input.toLowerCase();
  return Object.keys(operations)
    .map((id) => ({ id, d: editDistance(lower, id.toLowerCase()) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.id);
}

/** Check that a value loosely matches the ParamSpec's type string. */
function matchesType(value: unknown, typeString: string): boolean {
  const t = typeString.trim();
  if (t === "any") return true;
  if (t === "string") return typeof value === "string";
  if (t === "number") return typeof value === "number" && Number.isFinite(value);
  if (t === "boolean") return typeof value === "boolean";
  if (t.endsWith("[]")) return Array.isArray(value);
  // Union of string literals (e.g. `"Ascending" | "Descending"`).
  if (t.includes("|")) {
    const allowed = t.split("|").map((s) => s.trim().replace(/^"|"$/g, ""));
    return typeof value === "string" && allowed.includes(value);
  }
  return true;
}

interface ValidationResult {
  /** Errors that block the request. */
  errors: string[];
  /** Warnings that should be surfaced but don't block. */
  warnings: string[];
}

function validateParams(
  spec: OperationSpec,
  supplied: Record<string, any> | undefined,
  specParams: { name: string; required: boolean; type: string }[],
  kind: "path" | "query",
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validNames = new Set(specParams.map((p) => p.name));
  if (supplied) {
    for (const [name, value] of Object.entries(supplied)) {
      if (!validNames.has(name)) {
        // Path params: unknown names genuinely do nothing, so always error.
        // Query params: Emby's spec is incomplete, so only warn unless strict.
        const msg = `Unknown ${kind} parameter '${name}' for '${spec.operationId}'. Valid: ${
          specParams.map((p) => p.name).join(", ") || "(none)"
        }`;
        if (kind === "path" || strict) errors.push(msg);
        else warnings.push(msg);
        continue;
      }
      const pspec = specParams.find((p) => p.name === name)!;
      if (value !== undefined && value !== null && !matchesType(value, pspec.type)) {
        const msg = `Parameter '${name}' expects ${pspec.type}, got ${typeof value} ('${String(
          value
        )}')`;
        if (strict) errors.push(msg);
        else warnings.push(msg);
      }
    }
  }
  for (const p of specParams) {
    if (p.required && (!supplied || supplied[p.name] === undefined)) {
      errors.push(`Missing required ${kind} parameter '${p.name}' for '${spec.operationId}'`);
    }
  }
  return { errors, warnings };
}

export class RegistryHandler extends BaseHandler {
  async invoke(args: {
    operationId: string;
    pathParams?: Record<string, string | number>;
    queryParams?: Record<string, any>;
    body?: any;
    /**
     * When true, unknown query params or type mismatches fail the call.
     * When false (default), only path-param mismatches and truly missing
     * required params fail; other issues are logged to stderr.
     */
    strict?: boolean;
  }): Promise<McpToolResponse> {
    const spec = operations[args.operationId];
    if (!spec) {
      const suggestions = suggestOperationIds(args.operationId);
      return this.fail(
        `Unknown operationId '${args.operationId}'. Did you mean: ${suggestions.join(", ")}?`
      );
    }
    const strict = !!args.strict;
    const path = validateParams(spec, args.pathParams, spec.pathParams, "path", strict);
    const query = validateParams(spec, args.queryParams, spec.queryParams, "query", strict);
    const errors = [...path.errors, ...query.errors];
    const warnings = [...path.warnings, ...query.warnings];
    if (errors.length > 0) return this.fail(errors.join("\n"));
    if (warnings.length > 0) {
      // Surface warnings to operators via stderr without blocking the request.
      for (const w of warnings) console.error(`[emby-utils] warning: ${w}`);
    }
    return this.safeCall(() => this.emby.callOperation(args.operationId, args));
  }

  async rawRequest(args: {
    method: string;
    endpoint: string;
    body?: any;
    queryParams?: Record<string, any>;
  }): Promise<McpToolResponse> {
    return this.safeCall(() =>
      this.emby.request(args.method, args.endpoint, {
        body: args.body,
        queryParams: args.queryParams,
      })
    );
  }

  async listOperations(args: { tag?: string; search?: string } = {}): Promise<McpToolResponse> {
    let entries = Object.values(operations);
    if (args.tag) entries = entries.filter((o) => o.tag === args.tag);
    if (args.search) {
      const q = args.search.toLowerCase();
      entries = entries.filter(
        (o) =>
          o.operationId.toLowerCase().includes(q) ||
          o.summary.toLowerCase().includes(q) ||
          o.path.toLowerCase().includes(q)
      );
    }
    return this.ok(
      entries.map((o) => ({
        operationId: o.operationId,
        method: o.method,
        path: o.path,
        tag: o.tag,
        summary: o.summary,
      }))
    );
  }

  async describeOperation(args: { operationId: string }): Promise<McpToolResponse> {
    const op = operations[args.operationId];
    if (!op) return this.fail(`Unknown operationId: ${args.operationId}`);
    return this.ok(op);
  }
}
