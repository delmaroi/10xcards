// Framework-free aggregation for the S-04 metrics surface. `admin/metrics.astro`
// does the querying and renders; the arithmetic (and its divide-by-zero rules)
// lives here so it can be unit-tested.

export interface StatRow {
  generated: number;
  accepted: number;
}

export interface CardRow {
  source: string | null;
}

export interface MetricsSummary {
  /** Σaccepted / Σgenerated, or null when nothing has been generated yet. */
  acceptanceRate: number | null;
  /** Share of saved cards created by AI, or null for an empty deck. */
  aiShare: number | null;
  generatedTotal: number;
  batches: number;
  cardsTotal: number;
}

export const EMPTY_SUMMARY: MetricsSummary = {
  acceptanceRate: null,
  aiShare: null,
  generatedTotal: 0,
  batches: 0,
  cardsTotal: 0,
};

export function summarizeMetrics(stats: readonly StatRow[], cards: readonly CardRow[]): MetricsSummary {
  const generatedTotal = stats.reduce((sum, row) => sum + row.generated, 0);
  const acceptedTotal = stats.reduce((sum, row) => sum + row.accepted, 0);
  const aiCards = cards.filter((card) => card.source === "ai").length;

  return {
    batches: stats.length,
    generatedTotal,
    // A zero denominator is "no data yet", not 0% — the view renders null as "—".
    acceptanceRate: generatedTotal > 0 ? acceptedTotal / generatedTotal : null,
    cardsTotal: cards.length,
    aiShare: cards.length > 0 ? aiCards / cards.length : null,
  };
}

/** Render a rate as a percentage, or an em dash when there is no data. */
export function formatPercent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}
