// Global Vitest setup. Node-environment suites (lib, middleware, API endpoints) need
// nothing, so the DOM-only wiring is loaded conditionally — a bare `import` of
// jest-dom in a node-environment file would fail on the missing `document`.
import { afterEach } from "vitest";

if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  // Explicit teardown: auto-cleanup only kicks in with Vitest globals enabled.
  afterEach(() => {
    cleanup();
  });
}
