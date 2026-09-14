// Observe whether a native form submission was allowed through.
//
// Both auth forms POST natively; their React handler only decides whether to call
// preventDefault(). React attaches its listener to the ROOT CONTAINER, which sits
// below `document` in the bubble path — so a listener on `document` reliably sees
// the final `defaultPrevented` value. (A listener on the <form> itself would run
// first and always report false.)
import { vi } from "vitest";

export interface SubmitWatcher {
  /** True when a submit event reached document without having been prevented. */
  submitted: () => boolean;
  /** Spy called with `defaultPrevented` for each submit event. */
  seen: ReturnType<typeof vi.fn>;
  stop: () => void;
}

export function watchSubmit(): SubmitWatcher {
  const seen = vi.fn();
  const listener = (event: Event) => {
    seen(event.defaultPrevented);
    event.preventDefault(); // jsdom cannot navigate
  };
  document.addEventListener("submit", listener);

  return {
    seen,
    submitted: () => seen.mock.calls.some((call) => call[0] === false),
    stop: () => {
      document.removeEventListener("submit", listener);
    },
  };
}
