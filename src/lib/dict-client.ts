import type { DictionaryEntry } from "@/types";

export interface DictionaryLookupResult {
  word: string;
  entries: DictionaryEntry[];
}

/**
 * Error thrown when the dictionary endpoint responds with a non-ok status.
 * Carries the HTTP status so the caller can map 429/502/other to messages.
 * `status` is 0 for network/transport failures (no HTTP response).
 */
export class DictionaryLookupError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? `Dictionary lookup failed (${status})`);
    this.name = "DictionaryLookupError";
    this.status = status;
  }
}

/**
 * Call GET /api/dict/{word} and return the normalized result. An empty
 * `entries` array means the word was not found — that is a successful
 * outcome, not an error. Non-ok responses and transport failures throw a
 * {@link DictionaryLookupError}.
 */
export async function lookupWordClient(word: string): Promise<DictionaryLookupResult> {
  let res: Response;
  try {
    res = await fetch(`/api/dict/${encodeURIComponent(word)}`, {
      credentials: "include",
    });
  } catch {
    throw new DictionaryLookupError(0, "Network error");
  }

  if (!res.ok) {
    throw new DictionaryLookupError(res.status);
  }

  return res.json();
}
