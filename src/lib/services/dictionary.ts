/// <reference types="@cloudflare/workers-types" />

import type { DictionaryEntry } from "@/types";

interface RewriterText {
  text: string;
  lastInTextNode: boolean;
}

const BASE_URL = "https://dictionary.cambridge.org/dictionary/english/";
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:106.0) Gecko/20100101 Firefox/106.0",
  "Accept-Language": "en-US,en;q=0.5",
};

function cleanDefinition(raw: string): string {
  let def = raw.trim();
  def = def.charAt(0).toUpperCase() + def.slice(1);
  if (def.endsWith(":")) def = def.slice(0, -1);
  def = def.replace(/\s+/g, " ").trim() + ".";
  return def;
}

export async function lookupWord(word: string): Promise<DictionaryEntry[]> {
  const normalized = word.trim().replace(/\s+/g, "-").toLowerCase();
  const url = `${BASE_URL}${normalized}`;

  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (response.redirected && response.url === BASE_URL) {
    return [];
  }

  // A non-200 upstream (Cambridge down / error page) must surface as an error,
  // not a silent empty result. Without this guard the error-page body flows into
  // HTMLRewriter, matches no selectors, and returns [] — making "dictionary
  // down" indistinguishable from "unknown word". This throw lets the endpoint
  // return a clean 502. Placed AFTER the redirect short-circuit so an unknown
  // word (302 -> 200 at the base URL) still returns [] rather than throwing.
  if (!response.ok) {
    throw new Error(`Dictionary request failed with status ${response.status}`);
  }

  const entries: DictionaryEntry[] = [];
  let currentRegion = "";
  let parentDpos = "";
  let currentType = "";
  let currentInfo = "";
  let currentDef = "";
  let currentExamples: string[] = [];
  let exampleBuffer = "";
  let inExample = false;

  function finalizeExample() {
    if (inExample && exampleBuffer.trim()) {
      currentExamples.push(exampleBuffer.trim());
    }
    exampleBuffer = "";
    inExample = false;
  }

  function finalizeDefinition() {
    if (!currentDef) return;
    const definition = cleanDefinition(currentDef);
    const type = currentType.trim() || parentDpos.trim() || null;
    const info = currentInfo.trim() || null;
    const examples = currentExamples.slice(0, 2);
    // Cambridge sections don't always carry a recognizable UK/US region.
    // Emit null rather than coercing an unknown/empty string into the union.
    const region = currentRegion.trim().toUpperCase();
    const dictionaryRegion = region === "UK" || region === "US" ? region : null;
    entries.push({
      definition,
      type,
      dictionaryRegion,
      info,
      examples,
    });
  }

  // HTMLRewriter is a flat, streaming parser: all selectors are registered
  // up front and handlers fire in document order. There is no nested
  // `element.on(...)` — scoping is done with descendant selectors plus
  // boundary handlers (resetting/finalizing state when entering a new
  // `.dictionary` or `.ddef_block`). Text within an element can arrive in
  // multiple chunks, so each field handler resets its buffer on the element
  // start and appends every chunk; normalization happens at finalize time.
  const rewriter = new HTMLRewriter()
    .on(".dictionary", {
      element() {
        finalizeExample();
        finalizeDefinition();
        currentRegion = "";
        parentDpos = "";
        currentType = "";
        currentInfo = "";
        currentDef = "";
        currentExamples = [];
      },
    })
    .on(".dictionary .region", {
      element() {
        currentRegion = "";
      },
      text(t: RewriterText) {
        currentRegion += t.text;
      },
    })
    .on(".dictionary .dpos", {
      element() {
        parentDpos = "";
      },
      text(t: RewriterText) {
        parentDpos += t.text;
      },
    })
    .on(".dictionary .ddef_block", {
      element() {
        finalizeExample();
        finalizeDefinition();
        currentType = "";
        currentInfo = "";
        currentDef = "";
        currentExamples = [];
      },
    })
    .on(".ddef_block .dsense_pos", {
      element() {
        currentType = "";
      },
      text(t: RewriterText) {
        currentType += t.text;
      },
    })
    .on(".ddef_block .def-info", {
      element() {
        currentInfo = "";
      },
      text(t: RewriterText) {
        currentInfo += t.text;
      },
    })
    .on(".ddef_block .ddef_d", {
      element() {
        currentDef = "";
      },
      text(t: RewriterText) {
        currentDef += t.text;
      },
    })
    .on(".ddef_block .examp", {
      element() {
        finalizeExample();
        inExample = true;
        exampleBuffer = "";
      },
      text(t: RewriterText) {
        if (inExample) exampleBuffer += t.text;
      },
    });

  await rewriter.transform(response).arrayBuffer();

  finalizeExample();
  finalizeDefinition();

  return entries;
}
