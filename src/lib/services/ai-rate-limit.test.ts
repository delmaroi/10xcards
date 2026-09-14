import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkDictRateLimit,
  rateLimitKey,
  dictRateLimitKey,
  getHourlyLimit,
  getDictLimit,
} from "./ai-rate-limit";

// Fake KV mirroring the real KVNamespace get/put contract used by the gate:
// `get` returns the stored string or null; `put` stores a string value and
// records the `expirationTtl` option so the TTL contract can be asserted. The
// full KVNamespace interface has more methods, but the gate only touches these
// two — cast through `unknown` to satisfy the parameter type.
interface PutCall {
  key: string;
  value: string;
  expirationTtl?: number;
}

function makeKv() {
  const store = new Map<string, string>();
  const puts: PutCall[] = [];
  const kv = {
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    put: (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, value);
      puts.push({ key, value, expirationTtl: opts?.expirationTtl });
      return Promise.resolve();
    },
  };
  return { kv: kv as unknown as KVNamespace, store, puts };
}

// Fixed clock so keys are deterministic.
const NOW = new Date("2026-07-08T14:30:00.000Z");
const USER = "user-42";

describe("ai-rate-limit — key formats", () => {
  it("rateLimitKey uses hourly granularity", () => {
    expect(rateLimitKey(USER, NOW)).toBe("ai:hourly:user-42:2026-07-08T14");
  });

  it("dictRateLimitKey uses minute granularity", () => {
    expect(dictRateLimitKey(USER, NOW)).toBe("dict:minute:user-42:2026-07-08T14:30");
  });
});

describe("ai-rate-limit — limits", () => {
  it("getHourlyLimit defaults to 10", () => {
    expect(getHourlyLimit()).toBe(10);
  });

  it("getDictLimit is 30", () => {
    expect(getDictLimit()).toBe(30);
  });
});

describe("checkRateLimit (hourly)", () => {
  let harness: ReturnType<typeof makeKv>;

  beforeEach(() => {
    harness = makeKv();
  });

  it("allows and increments when under the limit", async () => {
    harness.store.set(rateLimitKey(USER, NOW), "3");

    const result = await checkRateLimit(harness.kv, USER, NOW);

    expect(result).toEqual({ allowed: true, limit: 10, remaining: 6 });
    // count incremented (3 → 4) and persisted with the hourly TTL.
    expect(harness.puts).toEqual([{ key: rateLimitKey(USER, NOW), value: "4", expirationTtl: 3600 }]);
  });

  it("allows on the first request (no prior count) and writes count 1", async () => {
    const result = await checkRateLimit(harness.kv, USER, NOW);

    expect(result).toEqual({ allowed: true, limit: 10, remaining: 9 });
    expect(harness.puts).toEqual([{ key: rateLimitKey(USER, NOW), value: "1", expirationTtl: 3600 }]);
  });

  it("denies without writing when at the limit", async () => {
    harness.store.set(rateLimitKey(USER, NOW), "10");

    const result = await checkRateLimit(harness.kv, USER, NOW);

    expect(result).toEqual({ allowed: false, limit: 10, remaining: 0 });
    expect(harness.puts).toEqual([]);
  });

  it("fails closed when kv is null", async () => {
    const result = await checkRateLimit(null, USER, NOW);

    expect(result).toEqual({ allowed: false, limit: 10, remaining: 0 });
  });
});

describe("checkDictRateLimit (minute)", () => {
  let harness: ReturnType<typeof makeKv>;

  beforeEach(() => {
    harness = makeKv();
  });

  it("allows and increments when under the limit", async () => {
    harness.store.set(dictRateLimitKey(USER, NOW), "5");

    const result = await checkDictRateLimit(harness.kv, USER, NOW);

    expect(result).toEqual({ allowed: true, limit: 30, remaining: 24 });
    // count incremented (5 → 6) and persisted with the 60s TTL.
    expect(harness.puts).toEqual([{ key: dictRateLimitKey(USER, NOW), value: "6", expirationTtl: 60 }]);
  });

  it("denies without writing when at the limit", async () => {
    harness.store.set(dictRateLimitKey(USER, NOW), "30");

    const result = await checkDictRateLimit(harness.kv, USER, NOW);

    expect(result).toEqual({ allowed: false, limit: 30, remaining: 0 });
    expect(harness.puts).toEqual([]);
  });

  it("fails closed when kv is null", async () => {
    const result = await checkDictRateLimit(null, USER, NOW);

    expect(result).toEqual({ allowed: false, limit: 30, remaining: 0 });
  });
});
