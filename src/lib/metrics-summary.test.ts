import { describe, it, expect } from "vitest";
import { summarizeMetrics, formatPercent, EMPTY_SUMMARY, type StatRow, type CardRow } from "@/lib/metrics-summary";

// Extracted from admin/metrics.astro. The load-bearing rule is the divide-by-zero
// one: "no data" must read as "—", never as a confident 0%.

const stats = (...rows: [number, number][]): StatRow[] =>
  rows.map(([generated, accepted]) => ({ generated, accepted }));
const cards = (...sources: (string | null)[]): CardRow[] => sources.map((source) => ({ source }));

describe("summarizeMetrics (S-04 metrics)", () => {
  it("computes acceptance rate across batches, not per-batch averages", () => {
    // 1/10 and 9/10 average to 50% per-batch but the true pooled rate is 50%;
    // use lopsided batch sizes so the two formulas cannot agree by accident.
    const summary = summarizeMetrics(stats([100, 10], [2, 2]), []);
    expect(summary.acceptanceRate).toBeCloseTo(12 / 102);
    expect(summary.generatedTotal).toBe(102);
    expect(summary.batches).toBe(2);
  });

  it("reports null acceptance rate when nothing was generated", () => {
    expect(summarizeMetrics(stats([0, 0]), []).acceptanceRate).toBeNull();
  });

  it("reports null acceptance rate with no batches at all", () => {
    expect(summarizeMetrics([], []).acceptanceRate).toBeNull();
  });

  it("computes the AI share of saved cards", () => {
    const summary = summarizeMetrics([], cards("ai", "ai", "manual", null));
    expect(summary.aiShare).toBeCloseTo(0.5);
    expect(summary.cardsTotal).toBe(4);
  });

  it("reports null AI share for an empty deck", () => {
    expect(summarizeMetrics([], []).aiShare).toBeNull();
  });

  it("counts only the exact 'ai' source, not any truthy value", () => {
    expect(summarizeMetrics([], cards("AI", "imported", null)).aiShare).toBe(0);
  });

  it("matches EMPTY_SUMMARY for empty inputs", () => {
    expect(summarizeMetrics([], [])).toEqual(EMPTY_SUMMARY);
  });

  it("handles a 100% acceptance rate", () => {
    expect(summarizeMetrics(stats([5, 5]), []).acceptanceRate).toBe(1);
  });
});

describe("formatPercent", () => {
  it("renders an em dash for null (no data)", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("renders 0 as 0.0%, not as missing data", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("renders one decimal place", () => {
    expect(formatPercent(0.12345)).toBe("12.3%");
    expect(formatPercent(1)).toBe("100.0%");
  });
});
