export interface ParseResult {
  valid: { front: string; back: string }[];
  skippedCount: number;
}

const SEPARATORS = [";", "\t", "-"] as const;

function countValidSplits(lines: string[], sep: string): number {
  let count = 0;
  for (const line of lines) {
    const parts = line.split(sep);
    if (parts.length === 2 && parts[0].trim() !== "" && parts[1].trim() !== "") {
      count++;
    }
  }
  return count;
}

export function parseCSV(text: string): ParseResult {
  const allLines = text.split("\n").map((l) => l.replace(/\r$/, ""));

  // Silently drop empty lines and comment lines — not counted as skipped
  const contentLines = allLines.filter((l) => l.trim() !== "" && !l.startsWith("#"));

  if (contentLines.length === 0) {
    return { valid: [], skippedCount: 0 };
  }

  // Auto-detect separator: pick the one producing the most valid two-part splits.
  // On a tie, the earlier candidate in SEPARATORS wins.
  let bestSep: string = SEPARATORS[0];
  let bestCount = -1;
  for (const sep of SEPARATORS) {
    const count = countValidSplits(contentLines, sep);
    if (count > bestCount) {
      bestCount = count;
      bestSep = sep;
    }
  }

  // If no separator produced any valid split, every content line is invalid.
  if (bestCount === 0) {
    return { valid: [], skippedCount: contentLines.length };
  }

  const valid: { front: string; back: string }[] = [];
  let skippedCount = 0;

  for (const line of contentLines) {
    const parts = line.split(bestSep);
    if (parts.length !== 2) {
      skippedCount++;
      continue;
    }
    const front = parts[0].trim();
    const back = parts[1].trim();
    if (front === "" || back === "" || front.length > 1000 || back.length > 1000) {
      skippedCount++;
      continue;
    }
    valid.push({ front, back });
  }

  return { valid, skippedCount };
}
