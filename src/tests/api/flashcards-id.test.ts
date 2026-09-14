import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/factories";

// PATCH/DELETE /api/flashcards/[id] — delegates to service functions.
// The endpoint reads context.locals.supabase and context.locals.user.

const updateFlashcard = vi.fn();
const deleteFlashcard = vi.fn();

vi.mock("@/lib/services/flashcards", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    updateFlashcard: (...args: unknown[]): unknown => updateFlashcard(...args),
    deleteFlashcard: (...args: unknown[]): unknown => deleteFlashcard(...args),
  };
});

const { PATCH, DELETE } = await import("@/pages/api/flashcards/[id]");

const USER = { id: "user-1" };
const SUPABASE = { from: vi.fn() };
const patchBody = JSON.stringify({ front: "new q", back: "new a" });

function context(
  options: {
    id?: string;
    method?: string;
    body?: string | null;
    user?: { id: string } | null;
    supabase?: unknown;
    params?: Record<string, string | undefined>;
  } = {},
) {
  const ctx = makeApiContext({
    url: `/api/flashcards/${options.id ?? "card-1"}`,
    method: options.method ?? "PATCH",
    headers: { "Content-Type": "application/json" },
    body: options.body ?? null,
    user: options.user === undefined ? USER : options.user,
    params: options.params ?? { id: options.id ?? "card-1" },
  });
  (ctx.locals as unknown as Record<string, unknown>).supabase =
    options.supabase === undefined ? SUPABASE : options.supabase;
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateFlashcard.mockResolvedValue({
    data: { id: "card-1", front: "new q", back: "new a" },
    error: null,
  });
  deleteFlashcard.mockResolvedValue({ error: null });
});

describe("PATCH /api/flashcards/[id]", () => {
  it("updates the card and returns 200", async () => {
    const response = await PATCH(context({ body: patchBody }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ id: "card-1", front: "new q", back: "new a" });
  });

  it("passes supabase, user id, card id, and content to the service", async () => {
    await PATCH(context({ id: "card-42", body: patchBody }));
    expect(updateFlashcard).toHaveBeenCalledWith(SUPABASE, "user-1", "card-42", { front: "new q", back: "new a" });
  });

  it("returns 401 for an anonymous caller", async () => {
    const response = await PATCH(context({ body: patchBody, user: null }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when supabase is not available", async () => {
    const response = await PATCH(context({ body: patchBody, supabase: null }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed JSON body", async () => {
    expect((await PATCH(context({ body: "{oops" }))).status).toBe(400);
    expect(await (await PATCH(context({ body: "{oops" }))).json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when front is empty", async () => {
    expect((await PATCH(context({ body: JSON.stringify({ front: "", back: "a" }) }))).status).toBe(400);
  });

  it("returns 400 when back is empty", async () => {
    expect((await PATCH(context({ body: JSON.stringify({ front: "q", back: "" }) }))).status).toBe(400);
  });

  it("returns 400 when the route matched without an id segment", async () => {
    const response = await PATCH(context({ body: patchBody, params: {} }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Flashcard ID is required" });
  });

  it("returns 404 when the service reports notFound", async () => {
    updateFlashcard.mockResolvedValue({
      data: null,
      error: { kind: "notFound", message: "Flashcard not found" },
    });
    const response = await PATCH(context({ body: patchBody }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Flashcard not found" });
  });

  it("returns 500 when the service reports a dbError", async () => {
    updateFlashcard.mockResolvedValue({
      data: null,
      error: { kind: "dbError", message: "db down" },
    });
    const response = await PATCH(context({ body: patchBody }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });
});

describe("DELETE /api/flashcards/[id]", () => {
  it("deletes the card and returns 200", async () => {
    const response = await DELETE(context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it("passes supabase, user id, and card id to the service", async () => {
    await DELETE(context({ id: "card-9" }));
    expect(deleteFlashcard).toHaveBeenCalledWith(SUPABASE, "user-1", "card-9");
  });

  it("returns 401 for an anonymous caller", async () => {
    const response = await DELETE(context({ user: null }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 when the route matched without an id segment", async () => {
    const response = await DELETE(context({ params: {} }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Flashcard ID is required" });
  });

  it("returns 404 when the service reports notFound", async () => {
    deleteFlashcard.mockResolvedValue({
      error: { kind: "notFound", message: "Flashcard not found" },
    });
    const response = await DELETE(context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Flashcard not found" });
  });

  it("returns 500 when the service reports a dbError", async () => {
    deleteFlashcard.mockResolvedValue({
      error: { kind: "dbError", message: "db down" },
    });
    const response = await DELETE(context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });
});
