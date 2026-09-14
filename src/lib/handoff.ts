import type { FlashcardProposal } from "@/lib/services/ai";

/**
 * Same-tab handoff between `/generate` and `/lookup_word`.
 *
 * Navigation between the two pages is a full page reload, so React state does
 * not survive. We bridge it through `sessionStorage` (same tab → reliable).
 * Every access is wrapped in try/catch: a storage throw (private mode quota,
 * blocked storage) must never break the page — reads return null, writes no-op.
 */

const LOOKUP_PREFILL_KEY = "cwg:lookup-prefill";
const GENERATE_SNAPSHOT_PREFIX = "cwg:generate-snapshot:";

export interface GenerateSnapshot {
  text: string;
  proposals: FlashcardProposal[];
}

function snapshotKey(setId: string): string {
  return `${GENERATE_SNAPSHOT_PREFIX}${setId}`;
}

/** Store the word/phrase to prefill the `/lookup_word` search field with. */
export function saveLookupPrefill(word: string): void {
  try {
    sessionStorage.setItem(LOOKUP_PREFILL_KEY, word);
  } catch {
    // sessionStorage unavailable — silently ignore.
  }
}

/** Read and remove the lookup prefill word (one-shot). Returns null if absent. */
export function consumeLookupPrefill(): string | null {
  try {
    const word = sessionStorage.getItem(LOOKUP_PREFILL_KEY);
    sessionStorage.removeItem(LOOKUP_PREFILL_KEY);
    return word;
  } catch {
    return null;
  }
}

/** Save the current `/generate` page state, keyed by setId. */
export function saveGenerateSnapshot(setId: string, snapshot: GenerateSnapshot): void {
  try {
    sessionStorage.setItem(snapshotKey(setId), JSON.stringify(snapshot));
  } catch {
    // sessionStorage unavailable or quota exceeded — silently ignore.
  }
}

/** Read and remove the `/generate` snapshot for setId (one-shot). Returns null if absent or malformed. */
export function consumeGenerateSnapshot(setId: string): GenerateSnapshot | null {
  try {
    const raw = sessionStorage.getItem(snapshotKey(setId));
    sessionStorage.removeItem(snapshotKey(setId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as GenerateSnapshot).text !== "string" ||
      !Array.isArray((parsed as GenerateSnapshot).proposals)
    ) {
      return null;
    }
    return parsed as GenerateSnapshot;
  } catch {
    return null;
  }
}

/** Remove the `/generate` snapshot for setId without reading it. */
export function clearGenerateSnapshot(setId: string): void {
  try {
    sessionStorage.removeItem(snapshotKey(setId));
  } catch {
    // sessionStorage unavailable — silently ignore.
  }
}

/** Whether a `/generate` snapshot currently exists for setId. */
export function hasGenerateSnapshot(setId: string): boolean {
  try {
    return sessionStorage.getItem(snapshotKey(setId)) !== null;
  } catch {
    return false;
  }
}
