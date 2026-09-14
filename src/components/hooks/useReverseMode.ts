import { useCallback, useState } from "react";

/**
 * Per-set "reverse mode" preference, persisted in localStorage under
 * `reverseMode:<setId>`. Defaults to `false` when no value is stored.
 *
 * The initial value is read in the useState initializer (guarded for SSR).
 * Consuming islands are mounted with `client:only="react"` (NOT `client:load`):
 * reading localStorage in the initializer would otherwise produce a
 * server/client hydration mismatch that React 19 does not patch. Do not switch
 * those islands back to `client:load`. Nothing is written on mount — only an
 * explicit `setReverse(...)` call persists the choice.
 */
export function useReverseMode(setId: string): [boolean, (value: boolean) => void] {
  const storageKey = `reverseMode:${setId}`;

  const [reverse, setReverse] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      // Storage disabled/blocked (e.g. Safari private mode) — fall back to off.
      return false;
    }
  });

  const persistReverse = useCallback(
    (value: boolean) => {
      setReverse(value);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, value ? "true" : "false");
      } catch {
        // Write may throw (QuotaExceededError / SecurityError) — preference stays in-memory only.
      }
    },
    [storageKey],
  );

  return [reverse, persistReverse];
}
