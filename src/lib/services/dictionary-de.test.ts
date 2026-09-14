import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `astro:env/server` is aliased (vitest.config.ts) to the same stub the `node`
// project uses (`getSecret` reads `process.env`). We override it per-test via
// `vi.mock` to control the secret-missing path explicitly.
vi.mock("astro:env/server", () => ({
  getSecret: vi.fn((name: string) => (name === "PONS_API_SECRET" ? "test-secret" : undefined)),
}));

import { lookupWordDe, ponsCacheKey, PONS_CACHE_TTL_SECONDS } from "./dictionary-de";
import type { DictionaryEntry } from "@/types";

function makeKvStub(getValue: DictionaryEntry[] | null = null): {
  kv: KVNamespace;
  putSpy: ReturnType<typeof vi.fn>;
  getSpy: ReturnType<typeof vi.fn>;
} {
  // Real Cloudflare KV's `get(key, "json")` parses the stored JSON and returns
  // the object (or null on miss). Mirror that contract: return the entries
  // object directly when "json" is requested, so the service's cache-hit path
  // sees a parsed result.
  const getSpy = vi.fn((_key: string, type?: string): unknown => {
    if (getValue === null) return null;
    return type === "json" ? getValue : JSON.stringify(getValue);
  });
  const putSpy = vi.fn(() => undefined);
  const kv = {
    get: getSpy,
    put: putSpy,
  } as unknown as KVNamespace;
  return { kv, putSpy, getSpy };
}

/** Build a representative Pons `depl` JSON body for `Haus`, mirroring the
 *  real shape observed against the live API (2026-07-19):
 *  [{ lang, hits: [{ roms: [{ wordclass, arabs: [{ translations: [{ source, target }] }] }] }] }]
 *  The German gloss lives in `<span class="sense">...</span>` inside `source`.
 */
function ponsHausFixture(): unknown {
  return [
    {
      lang: "de",
      hits: [
        {
          roms: [
            {
              headword: "Haus",
              wordclass: "rzeczownik",
              arabs: [
                {
                  translations: [
                    {
                      source:
                        '<strong class="headword">Haus</strong> <span class="sense">(Gebäude zum Wohnen, Heim, Zuhause)</span>',
                      target: 'dom <span class="genus"><acronym title="rodzaj męski">r.m.</acronym></span>',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

/** Build a polysemous fixture with 12 translations to exercise the 8-entry cap. */
function ponsPolysemousFixture(): unknown {
  return [
    {
      lang: "de",
      hits: [
        {
          roms: [
            {
              wordclass: "czasownik przechodni",
              arabs: [
                {
                  translations: Array.from({ length: 12 }, (_, i) => ({
                    source: `<strong class="headword">stellen</strong> <span class="sense">(sens ${i + 1})</span>`,
                    target: `postawić${i}`,
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

describe("lookupWordDe", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. returns [] for a Pons 204 (no entries)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { kv, putSpy } = makeKvStub(null);

    const entries = await lookupWordDe("qqqqxyz", { kv });
    expect(entries).toEqual([]);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("2. throws when fetch rejects (network / DNS failure)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("network failure"));

    await expect(lookupWordDe("Haus", { kv: null })).rejects.toThrow();
  });

  it("3. throws on AbortSignal timeout (AbortError)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const err = new Error("The operation was aborted");
    err.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(err);

    await expect(lookupWordDe("Haus", { kv: null })).rejects.toThrow();
  });

  it("4. throws on Pons 403 (secret invalid / quota exhausted)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));

    await expect(lookupWordDe("Haus", { kv: null })).rejects.toThrow(/status 403/);
  });

  it("5. throws on Pons 500/502/503/504", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    for (const status of [500, 502, 503, 504]) {
      fetchMock.mockResolvedValueOnce(new Response("err", { status }));
      await expect(lookupWordDe(`w${status}`, { kv: null })).rejects.toThrow(new RegExp(`status ${status}`));
    }
  });

  it("6. normalizes word: trims, replaces spaces with hyphens, lowercases", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    await lookupWordDe("  Light Year  ", { kv: null });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("q=light-year");
  });

  it("7. parses a representative Pons `depl` fixture into DictionaryEntry[]", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ponsHausFixture()), { status: 200 }));

    const entries = await lookupWordDe("Haus", { kv: null });
    expect(entries).toHaveLength(1);
    const e = entries[0];
    // type from rom.wordclass (Polish part-of-speech from Pons `depl`).
    expect(e.type).toBe("rzeczownik");
    // info extracted from `<span class="sense">...</span>` in source.
    expect(e.info).toContain("Gebäude zum Wohnen");
    expect(e.dictionaryRegion).toBeNull();
    // Polish translation present (after stripping inline HTML).
    expect(e.definition.toLowerCase()).toContain("dom");
    expect(e.definition).not.toContain("<");
    // This fixture has a single headword row and no example rows, so examples
    // stays empty (example grouping is covered by test 16).
    expect(e.examples).toEqual([]);
    // cleanDefinition capitalizes and appends a period.
    expect(e.definition.endsWith(".")).toBe(true);
  });

  it("8. strips Pons inline HTML tags from definition", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            lang: "de",
            hits: [
              {
                roms: [
                  {
                    wordclass: "rzeczownik",
                    arabs: [
                      {
                        translations: [
                          {
                            source: '<strong class="headword">Haus</strong>',
                            target: "<headword>dom</headword> <srcref>m</srcref> bud.",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]),
        { status: 200 },
      ),
    );

    const entries = await lookupWordDe("Haus", { kv: null });
    expect(entries[0].definition).not.toMatch(/<[^>]+>/);
    // cleanDefinition capitalizes first char, so "dom" → "Dom".
    expect(entries[0].definition.toLowerCase()).toContain("dom");
  });

  it("9. caps total entries at 8 for a polysemous-word fixture", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ponsPolysemousFixture()), { status: 200 }));

    const entries = await lookupWordDe("stellen", { kv: null });
    expect(entries).toHaveLength(8);
  });

  it("10. cache hit: KV get returns entries, fetch is NOT called", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const cached: DictionaryEntry[] = [
      {
        definition: "Cached.",
        type: "noun",
        dictionaryRegion: null,
        info: null,
        examples: [],
      },
    ];
    const { kv, getSpy } = makeKvStub(cached);

    const entries = await lookupWordDe("Haus", { kv });
    expect(entries).toEqual(cached);
    expect(getSpy).toHaveBeenCalledWith(ponsCacheKey("Haus"), "json");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("11. cache miss + 200: kv.put called with key, TTL 2592000, stringified entries", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ponsHausFixture()), { status: 200 }));
    const { kv, putSpy } = makeKvStub(null);

    const entries = await lookupWordDe("Haus", { kv });
    expect(putSpy).toHaveBeenCalledTimes(1);
    const [key, value, options] = putSpy.mock.calls[0] as [string, string, { expirationTtl: number }];
    expect(key).toBe(ponsCacheKey("Haus"));
    expect(value).toBe(JSON.stringify(entries));
    expect(options.expirationTtl).toBe(PONS_CACHE_TTL_SECONDS);
    expect(PONS_CACHE_TTL_SECONDS).toBe(2592000);
  });

  it("12. cache miss + 204: kv.put is NOT called (do not cache unknown words)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { kv, putSpy } = makeKvStub(null);

    await lookupWordDe("qqqqxyz", { kv });
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("13. cache miss + 403: kv.put is NOT called (do not cache errors)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    const { kv, putSpy } = makeKvStub(null);

    await expect(lookupWordDe("Haus", { kv })).rejects.toThrow();
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("14. skipCache: true bypasses both KV read and write, fetch is called", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ponsHausFixture()), { status: 200 }));
    const { kv, getSpy, putSpy } = makeKvStub(null);

    await lookupWordDe("Haus", { kv, skipCache: true });
    expect(getSpy).not.toHaveBeenCalled();
    expect(putSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("15. secret missing: lookupWordDe throws 'PONS_API_SECRET not configured'", async () => {
    vi.mocked(astroEnvGetSecret).mockReturnValueOnce(undefined);
    await expect(lookupWordDe("Haus", { kv: null })).rejects.toThrow("PONS_API_SECRET not configured");
  });

  it("16. groups example rows under their sense's primary headword (German + Polish)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    // One arab with two headword rows (dom, mieszkanie) followed by example
    // rows — mirrors the real `Haus` shape (source has class="headword" for
    // translations, class="example" for phrases; unmarked rows are idioms).
    const fixture = [
      {
        lang: "de",
        hits: [
          {
            roms: [
              {
                wordclass: "rzeczownik",
                arabs: [
                  {
                    header: "1. Haus:",
                    translations: [
                      {
                        source: '<strong class="headword">Haus</strong> <span class="sense">(Gebäude)</span>',
                        target: "dom",
                      },
                      {
                        source: '<strong class="headword">Haus</strong> <span class="sense">(Wohnung)</span>',
                        target: "mieszkanie",
                      },
                      {
                        source: '<span class="example">ins <strong class="tilde">Haus</strong> gehen</span>',
                        target: 'wchodzić <span class="genus">do</span> domu',
                      },
                      {
                        source: "Haus und Hof verspielen",
                        target: "przegrać ostatnią koszulę",
                      },
                    ],
                  },
                  {
                    header: '2. Haus <span class="sense">(Familie)</span>:',
                    translations: [{ source: '<strong class="headword">Haus</strong>', target: "rodzina" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }));

    const entries = await lookupWordDe("Haus", { kv: null });

    // Example rows are NOT promoted to entries: 3 headword rows → 3 entries.
    expect(entries).toHaveLength(3);

    // Both example rows attach to the sense's first headword (dom), formatted
    // "<German> — <Polish>" with HTML stripped and nbsp normalized.
    const dom = entries[0];
    expect(dom.definition.toLowerCase()).toContain("dom");
    expect(dom.examples).toEqual([
      "ins Haus gehen — wchodzić do domu",
      "Haus und Hof verspielen — przegrać ostatnią koszulę",
    ]);

    // The secondary headword of the same sense gets none of the examples.
    expect(entries[1].definition.toLowerCase()).toContain("mieszkanie");
    expect(entries[1].examples).toEqual([]);

    // A headword row without its own sense span falls back to the arab header
    // sense for `info`.
    expect(entries[2].definition.toLowerCase()).toContain("rodzina");
    expect(entries[2].info).toBe("(Familie)");
  });
});

// Imported lazily so `vi.mock` at the top of the file applies before the
// import resolves. The `astro:env/server` module is aliased to a stub and
// re-mocked above; we capture its `getSecret` to allow per-test overrides.
import * as astroEnvModule from "astro:env/server";
const astroEnvGetSecret = astroEnvModule.getSecret;
