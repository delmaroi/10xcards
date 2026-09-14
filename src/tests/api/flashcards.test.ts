import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeApiContext } from "@/test/factories";

// POST /api/flashcards — single-card creation via the flashcards service.
// The endpoint reads context.locals.supabase and context.locals.user.

const createFlashcard = vi.fn();

vi.mock("@/lib/services/flashcards", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    createFlashcard: (...args: unknown[]): unknown => createFlashcard(...args),
  };
});

const { POST } = await import("@/pages/api/flashcards/index");

const USER = { id: "user-1" };
const SUPABASE = { from: vi.fn() }; // stub; the real client is injected via locals

function context(body: string | null, user: { id: string } | null = USER, supabase: unknown = SUPABASE) {
  const ctx = makeApiContext({
    url: "/api/flashcards",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    user,
  });
  (ctx.locals as unknown as Record<string, unknown>).supabase = supabase;
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  createFlashcard.mockResolvedValue({
    data: { id: "card-1", set_id: "set-1", front: "q1", back: "a1" },
    error: null,
  });
});

describe("POST /api/flashcards", () => {
  it("creates a flashcard and returns 201", async () => {
    const response = await POST(context(JSON.stringify({ set_id: "set-1", front: "q1", back: "a1" })));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: "card-1", set_id: "set-1", front: "q1", back: "a1" });
  });

  it("passes supabase client and user id to the service", async () => {
    await POST(context(JSON.stringify({ set_id: "set-1", front: "q1", back: "a1" })));
    expect(createFlashcard).toHaveBeenCalledWith(SUPABASE, "user-1", "set-1", { front: "q1", back: "a1" });
  });

  it("returns 401 for an anonymous caller", async () => {
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "q", back: "a" }), null));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when supabase is not available in locals", async () => {
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "q", back: "a" }), USER, null));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const response = await POST(context("{not json"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when set_id is missing", async () => {
    const response = await POST(context(JSON.stringify({ front: "q", back: "a" })));
    expect(response.status).toBe(400);
    const body: { error: string } = await response.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 400 when front is empty", async () => {
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "", back: "a" })));
    expect(response.status).toBe(400);
  });

  it("returns 400 when back is empty", async () => {
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "q", back: "" })));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the service reports notFound", async () => {
    createFlashcard.mockResolvedValue({
      data: null,
      error: { kind: "notFound", message: "Set not found" },
    });
    const response = await POST(context(JSON.stringify({ set_id: "missing", front: "q", back: "a" })));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Set not found" });
  });

  it("returns 400 when the service reports validationError", async () => {
    createFlashcard.mockResolvedValue({
      data: null,
      error: { kind: "validationError", message: "Duplicate front" },
    });
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "dup", back: "a" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Duplicate front" });
  });

  it("returns 500 when the service reports a dbError", async () => {
    createFlashcard.mockResolvedValue({
      data: null,
      error: { kind: "dbError", message: "db down" },
    });
    const response = await POST(context(JSON.stringify({ set_id: "s", front: "q", back: "a" })));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });
});
