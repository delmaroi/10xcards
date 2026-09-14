// Chainable Supabase double. The real client builds queries fluently and resolves at
// whatever point you await (`.insert(rows)`, `.update().eq().select()`, …), so the
// stub returns itself from every builder method and is thenable — that lets one
// object stand in for every shape our endpoints use, while recording the calls so a
// test can assert the query it MEANT to send (right table, filtered by id, …).
import { vi } from "vitest";

export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export interface QueryResult {
  data?: unknown;
  error?: unknown;
}

const BUILDER_METHODS = ["select", "insert", "update", "delete", "eq", "order", "limit", "single"] as const;

export interface SupabaseStub {
  client: unknown;
  calls: RecordedCall[];
  from: ReturnType<typeof vi.fn>;
  /** Calls recorded for one builder method, in order. */
  callsTo: (method: string) => RecordedCall[];
}

export function makeSupabaseStub(
  config: {
    /** Per-table result; falls back to `defaultResult`. */
    results?: Record<string, QueryResult>;
    /**
     * Per-table results consumed one per `from()` call — for endpoints that issue
     * several statements against one table (load-then-save) and need each to differ.
     */
    sequences?: Record<string, QueryResult[]>;
    defaultResult?: QueryResult;
    auth?: Record<string, unknown>;
  } = {},
): SupabaseStub {
  const calls: RecordedCall[] = [];

  const pending: Record<string, QueryResult[] | undefined> = Object.fromEntries(
    Object.entries(config.sequences ?? {}).map(([table, queue]) => [table, [...queue]]),
  );

  const from = vi.fn((table: string) => {
    const result: QueryResult = pending[table]?.shift() ??
      config.results?.[table] ??
      config.defaultResult ?? { data: [], error: null };
    const chain: Record<string, unknown> = {
      then: (resolve: (value: QueryResult) => unknown) => resolve(result),
    };
    for (const method of BUILDER_METHODS) {
      chain[method] = vi.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      });
    }
    return chain;
  });

  return {
    client: { from, auth: config.auth ?? {} },
    calls,
    from,
    callsTo: (method: string) => calls.filter((call) => call.method === method),
  };
}
