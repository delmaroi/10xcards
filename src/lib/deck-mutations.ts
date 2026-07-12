import { z } from "zod";

// Framework-free handlers for editing/deleting a saved card (S-03). No astro:* imports
// → unit-testable. The DB op is injected; "found" is derived from affected rows so a
// non-owner's statement (0 rows under RLS) maps to 404, never a leak.

export interface MutationResponse {
  status: number;
  body: Record<string, unknown>;
}

const updateSchema = z.object({ front: z.string().min(1), back: z.string().min(1) });

export async function handleUpdateCard(input: {
  userId: string | null;
  id: string;
  body: unknown;
  updateCard: (id: string, patch: { front: string; back: string }) => Promise<{ ok: boolean; found: boolean }>;
}): Promise<MutationResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  if (!input.id) return { status: 400, body: { error: "invalid_request" } };

  const parsed = updateSchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: { error: "invalid_request" } };

  const { ok, found } = await input.updateCard(input.id, parsed.data);
  if (!ok) return { status: 500, body: { error: "update_failed" } };
  if (!found) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: { updated: true } };
}

export async function handleDeleteCard(input: {
  userId: string | null;
  id: string;
  deleteCard: (id: string) => Promise<{ ok: boolean; found: boolean }>;
}): Promise<MutationResponse> {
  if (!input.userId) return { status: 401, body: { error: "unauthorized" } };
  if (!input.id) return { status: 400, body: { error: "invalid_request" } };

  const { ok, found } = await input.deleteCard(input.id);
  if (!ok) return { status: 500, body: { error: "delete_failed" } };
  if (!found) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: { deleted: true } };
}
