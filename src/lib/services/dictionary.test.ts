import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupWord } from "./dictionary";

// These tests run in the "workers" Vitest project (see vitest.config.ts), so
// `HTMLRewriter` is the real Workers-native parser — NOT a mock. Only `fetch`
// is stubbed, to feed fixture HTML (or simulate the invalid-word redirect)
// without hitting dictionary.cambridge.org over the network.

const BASE_URL = "https://dictionary.cambridge.org/dictionary/english/";

function makeHtmlFixture(bodyContent: string): string {
  return `<!DOCTYPE html><html><head></head><body>${bodyContent}</body></html>`;
}

/** Stub `fetch` to return a real Response carrying the given HTML body. */
function stubFetchHtml(html: string, finalUrl: string) {
  const fetchMock = vi.mocked(globalThis.fetch);
  fetchMock.mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }));
  // `Response.url`/`redirected` are read-only and cannot be set via the
  // constructor; the scraper only inspects them for the redirect short-circuit,
  // which these (non-redirected) fixtures intentionally do not trigger.
  void finalUrl;
}

describe("lookupWord", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns empty array for invalid word (redirect to base URL)", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    // Simulate the invalid-word 302 chain ending at the base URL. A plain
    // object suffices: lookupWord returns before reaching HTMLRewriter.transform.
    fetchMock.mockResolvedValueOnce({
      redirected: true,
      url: BASE_URL,
    } as Response);

    const entries = await lookupWord("xyznotaword");
    expect(entries).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}xyznotaword`,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("throws when fetch rejects (network / DNS failure)", async () => {
    // A hard transport failure must propagate so the endpoint can return 502.
    // This is the precondition the endpoint's 502 catch relies on.
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("network failure"));

    await expect(lookupWord("cat")).rejects.toThrow();
  });

  it("throws on a non-200 upstream response (dictionary down) instead of returning []", async () => {
    // A 503 error page must NOT be silently parsed into an empty result — that
    // would make "dictionary down" indistinguishable from "unknown word".
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(new Response("<html><body>503 Service Unavailable</body></html>", { status: 503 }));

    // Assert the message carries the status, not just that it throws — the value
    // of the fix is a *distinguishable* error, so lock that property in.
    await expect(lookupWord("cat")).rejects.toThrow(/status 503/);
  });

  it("normalizes word: trims, replaces spaces with hyphens, lowercases", async () => {
    stubFetchHtml(makeHtmlFixture(""), `${BASE_URL}light-year`);

    await lookupWord(" Light Year ");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(`${BASE_URL}light-year`, expect.any(Object));
  });

  it("parses a word with UK+US definitions, CEFR levels, and examples", async () => {
    const html = makeHtmlFixture(`
      <div class="dictionary">
        <span class="region">uk</span>
        <span class="dpos">noun</span>
        <div class="ddef_block">
          <span class="dsense_pos">noun</span>
          <span class="def-info">B1</span>
          <div class="ddef_d">a small domesticated carnivorous mammal</div>
          <span class="examp">The cat sat on the mat.</span>
          <span class="examp">She adopted a stray cat.</span>
        </div>
      </div>
      <div class="dictionary">
        <span class="region">us</span>
        <span class="dpos">noun</span>
        <div class="ddef_block">
          <span class="dsense_pos">noun</span>
          <span class="def-info">B1</span>
          <div class="ddef_d">a small furry animal often kept as a pet</div>
          <span class="examp">I have two cats at home.</span>
        </div>
      </div>
    `);
    stubFetchHtml(html, `${BASE_URL}cat`);

    const entries = await lookupWord("cat");
    expect(entries).toHaveLength(2);

    expect(entries[0]).toMatchObject({
      dictionaryRegion: "UK",
      type: "noun",
      info: "B1",
      examples: ["The cat sat on the mat.", "She adopted a stray cat."],
    });
    expect(entries[0].definition).toContain("small domesticated carnivorous mammal");

    expect(entries[1]).toMatchObject({
      dictionaryRegion: "US",
      type: "noun",
      info: "B1",
      examples: ["I have two cats at home."],
    });
  });

  it("falls back to parent dpos when dsense_pos is missing", async () => {
    const html = makeHtmlFixture(`
      <div class="dictionary">
        <span class="region">uk</span>
        <span class="dpos">adjective</span>
        <div class="ddef_block">
          <span class="def-info">A2</span>
          <div class="ddef_d">having a high temperature</div>
          <span class="examp">The soup was hot.</span>
        </div>
      </div>
    `);
    stubFetchHtml(html, `${BASE_URL}hot`);

    const entries = await lookupWord("hot");
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("adjective");
  });

  it("truncates examples to max 2", async () => {
    const html = makeHtmlFixture(`
      <div class="dictionary">
        <span class="region">uk</span>
        <span class="dpos">verb</span>
        <div class="ddef_block">
          <span class="dsense_pos">verb</span>
          <div class="ddef_d">to move at a speed faster than a walk</div>
          <span class="examp">She runs every morning.</span>
          <span class="examp">He ran to catch the bus.</span>
          <span class="examp">The children ran around the playground.</span>
          <span class="examp">I run a small business.</span>
        </div>
      </div>
    `);
    stubFetchHtml(html, `${BASE_URL}run`);

    const entries = await lookupWord("run");
    expect(entries).toHaveLength(1);
    expect(entries[0].examples).toHaveLength(2);
    expect(entries[0].examples).toEqual(["She runs every morning.", "He ran to catch the bus."]);
  });

  it("cleans definition text: trailing colon, whitespace, capitalization, period", async () => {
    const html = makeHtmlFixture(`
      <div class="dictionary">
        <span class="region">uk</span>
        <span class="dpos">noun</span>
        <div class="ddef_block">
          <span class="dsense_pos">noun</span>
          <div class="ddef_d">  a state of  mental   clarity  :</div>
        </div>
      </div>
    `);
    stubFetchHtml(html, `${BASE_URL}lucidity`);

    const entries = await lookupWord("lucidity");
    expect(entries).toHaveLength(1);
    expect(entries[0].definition).toBe("A state of mental clarity.");
  });

  it("handles missing optional fields (type, info, examples)", async () => {
    const html = makeHtmlFixture(`
      <div class="dictionary">
        <span class="region">uk</span>
        <div class="ddef_block">
          <div class="ddef_d">an example word</div>
        </div>
      </div>
    `);
    stubFetchHtml(html, `${BASE_URL}example`);

    const entries = await lookupWord("example");
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBeNull();
    expect(entries[0].info).toBeNull();
    expect(entries[0].examples).toEqual([]);
  });

  it("returns empty array when page has no dictionary blocks", async () => {
    stubFetchHtml(makeHtmlFixture("<div>No dictionary content</div>"), `${BASE_URL}something`);

    const entries = await lookupWord("something");
    expect(entries).toEqual([]);
  });
});
