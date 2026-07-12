import { z } from "zod";

// Framework-free handler for saving accepted proposals to the deck (S-02). No astro:*
// imports → unit-testable. The insert is injected so the single atomic write can be
// stubbed in tests; the endpoint passes a one-call supabase.insert (all-or-nothing).

export interface FlashcardRow {
  user_id: string;
  front: string;
  back: string;
  source: "ai";
}

export interface SaveResponse {
  status: number;
  body: { saved: number } | { error: string };
}

const saveSchema = z.object({
  cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1),
});

export async function handleSaveRequest(input: {
  userId: string | null;
  body: unknown;
  insertCards: (rows: FlashcardRow[]) => Promise<{ error: unknown }>;
}): Promise<SaveResponse> {
  if (!input.userId) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const parsed = saveSchema.safeParse(input.body);
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_request" } };
  }

  const userId = input.userId;
  // Owner-scoped rows; user_id comes from the session, never the client.
  const rows: FlashcardRow[] = parsed.data.cards.map((c) => ({
    user_id: userId,
    front: c.front,
    back: c.back,
    source: "ai",
  }));

  // Single insert = one statement = all-or-nothing (R4 atomicity).
  const { error } = await input.insertCards(rows);
  if (error) {
    return { status: 500, body: { error: "save_failed" } };
  }

  return { status: 201, body: { saved: rows.length } };
}
