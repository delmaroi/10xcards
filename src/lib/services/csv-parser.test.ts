import { describe, it, expect } from "vitest";
import { parseCSV } from "./csv-parser";

describe("parseCSV", () => {
  describe("separator detection", () => {
    it("parses tab-separated file", () => {
      const result = parseCSV("front1\tback1\nfront2\tback2");
      expect(result.valid).toEqual([
        { front: "front1", back: "back1" },
        { front: "front2", back: "back2" },
      ]);
      expect(result.skippedCount).toBe(0);
    });

    it("parses semicolon-separated file", () => {
      const result = parseCSV("front1;back1\nfront2;back2");
      expect(result.valid).toEqual([
        { front: "front1", back: "back1" },
        { front: "front2", back: "back2" },
      ]);
      expect(result.skippedCount).toBe(0);
    });

    it("parses dash-separated file", () => {
      const result = parseCSV("front1-back1\nfront2-back2");
      expect(result.valid).toEqual([
        { front: "front1", back: "back1" },
        { front: "front2", back: "back2" },
      ]);
      expect(result.skippedCount).toBe(0);
    });

    it("uses most-frequent separator when mixed", () => {
      // 3 tab-separated lines, 1 semicolon-separated line → tab wins
      const result = parseCSV("a\tb\nc\td\ne\tf\nx;y");
      expect(result.valid).toHaveLength(3);
      expect(result.valid[0]).toEqual({ front: "a", back: "b" });
      expect(result.skippedCount).toBe(1); // "x;y" has no tab → invalid with tab separator
    });

    it("semicolon beats tab on tie (earlier in priority order)", () => {
      // 1 semicolon line, 1 tab line → tie → semicolon wins (first in array)
      const result = parseCSV("a;b\nc\td");
      // with semicolon: "a;b" → valid, "c\td" → 1 part (no semicolon) → skipped
      expect(result.valid).toEqual([{ front: "a", back: "b" }]);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("silent drops (not counted in skippedCount)", () => {
    it("silently drops empty lines", () => {
      const result = parseCSV("front1;back1\n\nfront2;back2\n");
      expect(result.valid).toHaveLength(2);
      expect(result.skippedCount).toBe(0);
    });

    it("silently drops lines starting with #", () => {
      const result = parseCSV("#separator:semicolon\nfront1;back1\n# comment\nfront2;back2");
      expect(result.valid).toHaveLength(2);
      expect(result.skippedCount).toBe(0);
    });

    it("silently drops CRLF line endings", () => {
      const result = parseCSV("front1;back1\r\nfront2;back2\r\n");
      expect(result.valid).toHaveLength(2);
      expect(result.skippedCount).toBe(0);
    });
  });

  describe("validation (counted in skippedCount)", () => {
    it("skips line where front exceeds 1000 chars", () => {
      const longFront = "a".repeat(1001);
      const result = parseCSV(`${longFront};back\nfront;back`);
      expect(result.valid).toEqual([{ front: "front", back: "back" }]);
      expect(result.skippedCount).toBe(1);
    });

    it("skips line where back exceeds 1000 chars", () => {
      const longBack = "b".repeat(1001);
      const result = parseCSV(`front;${longBack}\nfront2;back2`);
      expect(result.valid).toEqual([{ front: "front2", back: "back2" }]);
      expect(result.skippedCount).toBe(1);
    });

    it("skips line that does not split into exactly 2 parts", () => {
      // Using semicolon separator; "no-separator-here" has no semicolon
      const result = parseCSV("front;back\nno-separator-here\nfront2;back2");
      expect(result.valid).toHaveLength(2);
      expect(result.skippedCount).toBe(1);
    });

    it("skips line with empty front after trim", () => {
      const result = parseCSV(";back\nfront;back");
      expect(result.valid).toEqual([{ front: "front", back: "back" }]);
      expect(result.skippedCount).toBe(1);
    });

    it("skips line with empty back after trim", () => {
      const result = parseCSV("front;\nfront2;back2");
      expect(result.valid).toEqual([{ front: "front2", back: "back2" }]);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns empty result for empty string", () => {
      const result = parseCSV("");
      expect(result.valid).toEqual([]);
      expect(result.skippedCount).toBe(0);
    });

    it("returns all-invalid when no separator produces any valid split", () => {
      // Lines with no recognisable separator
      const result = parseCSV("noSeparatorHere\nalsoNoSeparator");
      expect(result.valid).toEqual([]);
      expect(result.skippedCount).toBe(2);
    });

    it("trims whitespace around front and back", () => {
      const result = parseCSV("  front  ;  back  ");
      expect(result.valid).toEqual([{ front: "front", back: "back" }]);
    });

    it("accepts front/back exactly 1000 chars long", () => {
      const exactly1000 = "x".repeat(1000);
      const result = parseCSV(`${exactly1000};${exactly1000}`);
      expect(result.valid).toHaveLength(1);
      expect(result.skippedCount).toBe(0);
    });
  });
});
