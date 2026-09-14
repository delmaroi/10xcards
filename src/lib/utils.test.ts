import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

// `cn` is the class-merge every component leans on for conditional styling. The
// contract worth locking is Tailwind CONFLICT RESOLUTION (last wins) — plain
// concatenation would silently ship both classes and let source order decide.

describe("cn class merger", () => {
  it("joins plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values instead of emitting 'false'/'undefined'", () => {
    // Read through a typed array so TypeScript keeps the flag as `boolean` rather
    // than narrowing it to `false` — components pass real state into this slot.
    const flags: boolean[] = [false];
    expect(cn("a", flags[0] && "b", undefined, null, "c")).toBe("a c");
  });

  it("lets a later Tailwind utility override an earlier conflicting one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-300", "text-green-300")).toBe("text-green-300");
  });

  it("keeps non-conflicting utilities from the same family", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("supports the conditional-object and array forms the components use", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("returns an empty string when everything is falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});
