import { z } from "zod";

// Framework-free handler recording one generation-triage batch (S-04). No astro:*
// imports → unit-testable. The insert is injected. Owner id comes from the session,
// never the client. Feeds the AI acceptance-rate metric (Σaccepted / Σgenerated).

export interface StatsResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface GenerationStatRow {
  user_id: string;
  generated: number;
  accepted: number;
  edited: number;
}

const schema = z.object({
  generated: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  edited: z.number().int().nonnegative(),
});

export async function handleRecordStats(input: {
  userId: string | null;
  body: unknown;
  insertStat: (row: GenerationStatRow) => Promise<{ error: unknown }>;
}): Promise<StatsResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };

  const parsed = schema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "invalid_request" } };

  const { generated, accepted, edited } = parsed.data;
  // Sanity: accepted ⊆ generated, edited ⊆ accepted. Rejects impossible counts.
  if (accepted > generated || edited > accepted) return { status: 400, body: { error: "invalid_request" } };

  const { error } = await input.insertStat({ user_id: input.userId, generated, accepted, edited });
  if (error) return { status: 500, body: { error: "record_failed" } };

  return { status: 201, body: { recorded: true } };
}
