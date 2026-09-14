/// <reference types="@cloudflare/workers-types" />

import type { DictionaryEntry } from "@/types";
import { getSecret } from "astro:env/server";

export const PONS_CACHE_TTL_SECONDS = 2592000;

const PONS_BASE_URL = "https://api.pons.com/v1/dictionary";
const PONS_DICT = "depl";
const PONS_LANGUAGE = "pl";
const PONS_TIMEOUT_MS = 10000;
const MAX_ENTRIES = 8;
// Cap example pairs per sense so a highly-idiomatic word (Pons returns ~20
// example phrases for the primary sense of `Haus`) does not produce one giant
// card. Examples are attached to the sense's primary translation.
const MAX_EXAMPLES_PER_ENTRY = 6;
// Joins a German example phrase to its Polish translation. `EntryCard` splits
// on the first occurrence of this exact separator to style the two sides.
const EXAMPLE_SEPARATOR = " — ";

// `v2` bumps the cache namespace after the response mapping changed to group
// example phrases under their sense (previously every translation — including
// examples — was flattened to a separate entry with `examples: []`). Old `v1`
// entries have the wrong shape; a fresh prefix sidesteps stale-cache reads.
export function ponsCacheKey(word: string): string {
  return `pons:de:v2:${normalizeWord(word)}`;
}

function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, "-").toLowerCase();
}

function cleanDefinition(raw: string): string {
  let def = raw.trim();
  def = def.charAt(0).toUpperCase() + def.slice(1);
  if (def.endsWith(":")) def = def.slice(0, -1);
  def = def.replace(/\s+/g, " ").trim() + ".";
  return def;
}

function stripInlineHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// Strip HTML, normalize the non-breaking spaces Pons embeds (U+00A0), and
// collapse runs of whitespace. Used for both German example phrases and their
// Polish translations before display.
function normalizeText(s: string): string {
  return stripInlineHtml(s).replace(/\s+/g, " ").trim();
}

// Pons `depl` JSON shape (verified against live API, 2026-07-19):
//   [{ lang, hits: [{ type, opendict, roms: [{ headword, headword_full,
//     wordclass, arabs: [{ header, translations: [{ source, target }] }] }] }] }]
// `wordclass` is the Polish part-of-speech (e.g. "rzeczownik", "czasownik
// przechodni"). Within an `arab` (one numbered sense) the `translations` array
// mixes two kinds of rows, distinguished by markup in `source`:
//   - headword rows (`<strong class="headword">`) — the actual translation of
//     the word in this sense; each becomes a `DictionaryEntry`. The German
//     sense gloss lives in `<span class="sense">...</span>` (or, as a fallback,
//     in the `arab.header`) and populates `info`.
//   - example/idiom rows (`<span class="example">` or neither marker) — a
//     German phrase + its Polish translation. These are NOT separate entries;
//     they attach as `"<German> — <Polish>"` example pairs to the sense's
//     primary (first) headword translation, so each card shows both the
//     original German and its Polish rendering.
interface PonsTranslation {
  source: string;
  target: string;
}

interface PonsArab {
  header?: string;
  translations?: PonsTranslation[];
}

interface PonsRom {
  wordclass?: string;
  arabs?: PonsArab[];
}

interface PonsHit {
  roms?: PonsRom[];
}

interface PonsTopLevel {
  hits?: PonsHit[];
}

interface LookupOpts {
  kv?: KVNamespace | null;
  skipCache?: boolean;
}

export async function lookupWordDe(word: string, opts: LookupOpts = {}): Promise<DictionaryEntry[]> {
  const secret = getSecret("PONS_API_SECRET");
  if (!secret) {
    throw new Error("PONS_API_SECRET not configured");
  }

  const kv = opts.kv ?? null;
  const skipCache = opts.skipCache ?? false;
  const normalized = normalizeWord(word);

  if (kv && !skipCache) {
    try {
      const cached = await kv.get(ponsCacheKey(word), "json");
      if (cached) {
        return cached as DictionaryEntry[];
      }
    } catch {
      // cache read is best-effort — fall through to a live Pons fetch
    }
  }

  const url = `${PONS_BASE_URL}?q=${encodeURIComponent(normalized)}&l=${PONS_DICT}&language=${PONS_LANGUAGE}&fm=1&ref=true`;
  const response = await fetch(url, {
    headers: { "X-Secret": secret },
    signal: AbortSignal.timeout(PONS_TIMEOUT_MS),
  });

  if (response.status === 204) {
    return [];
  }
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Pons request failed with status ${response.status}`);
  }

  const top: PonsTopLevel[] = await response.json();
  const entries = mapPonsResponse(top);

  if (kv && !skipCache) {
    try {
      await kv.put(ponsCacheKey(word), JSON.stringify(entries), {
        expirationTtl: PONS_CACHE_TTL_SECONDS,
      });
    } catch {
      // cache write is best-effort — do not fail the lookup
    }
  }

  return entries;
}

// A headword row carries the actual translation of the word for a sense; every
// other row (`<span class="example">` or an unmarked idiom) is an example we
// attach to the sense's primary translation rather than promoting to its own
// entry.
function isHeadwordSource(source: string): boolean {
  return source.includes('class="headword"');
}

// Format a German example phrase and its Polish translation as one display
// string. Falls back to whichever side is present if the other is empty.
function formatExample(source: string, target: string): string {
  const de = normalizeText(source);
  const pl = normalizeText(target);
  if (!de) return pl;
  if (!pl) return de;
  return `${de}${EXAMPLE_SEPARATOR}${pl}`;
}

function mapPonsResponse(top: PonsTopLevel[]): DictionaryEntry[] {
  const entries: DictionaryEntry[] = [];

  for (const langBlock of top) {
    for (const hit of langBlock.hits ?? []) {
      for (const rom of hit.roms ?? []) {
        const type = (rom.wordclass ?? "").trim() || null;
        for (const arab of rom.arabs ?? []) {
          // German sense descriptor for the whole `arab` (e.g. "Familie"),
          // used as the `info` fallback when a headword row has no own sense.
          const arabSense = extractSense(arab.header ?? "");
          // Examples attach to the first headword translation of this sense.
          let arabPrimary: DictionaryEntry | null = null;

          for (const translation of arab.translations ?? []) {
            const { source, target } = translation;

            if (isHeadwordSource(source)) {
              if (entries.length >= MAX_ENTRIES) return entries;

              const entry: DictionaryEntry = {
                definition: cleanDefinition(stripInlineHtml(target)),
                type,
                dictionaryRegion: null,
                info: extractSense(source) ?? arabSense,
                examples: [],
              };
              entries.push(entry);
              arabPrimary ??= entry;
              continue;
            }

            // Example / idiom row. Attach it to this sense's primary entry (or,
            // for a rare headword-less sense, to the most recent entry so the
            // German original + Polish are still surfaced rather than dropped).
            const host = arabPrimary ?? (entries.length > 0 ? entries[entries.length - 1] : null);
            if (!host || host.examples.length >= MAX_EXAMPLES_PER_ENTRY) continue;
            const example = formatExample(source, target);
            if (example) host.examples.push(example);
          }
        }
      }
    }
  }

  return entries;
}

// Pull the German gloss out of `<span class="sense">...</span>` if present in
// the source field. Returns trimmed text or null when no sense span exists.
function extractSense(source: string): string | null {
  const match = /<span class="sense">([\s\S]*?)<\/span>/i.exec(source);
  if (!match) return null;
  const text = normalizeText(match[1]);
  return text || null;
}
