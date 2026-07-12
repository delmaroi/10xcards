import { describe, it, expect, vi } from "vitest";
import { handleSaveRequest, type FlashcardRow } from "@/lib/save-flashcards";

type Insert = (rows: FlashcardRow[]) => Promise<{ error: unknown }>;
const okInsert = () => vi.fn<Insert>().mockResolvedValue({ error: null });

describe("handleSaveRequest (S-02 atomic save)", () => {
  it("returns 401 when there is no user", async () => {
    const insertCards = okInsert();
    const r = await handleSaveRequest({ userId: null, body: { cards: [{ front: "Q", back: "A" }] }, insertCards });
    expect(r.status).toBe(401);
    expect(insertCards).not.toHaveBeenCalled();
  });

  it("returns 400 on an empty/malformed card set", async () => {
    const r = await handleSaveRequest({ userId: "u1", body: { cards: [] }, insertCards: okInsert() });
    expect(r.status).toBe(400);
  });

  it("inserts all cards in a single owner-scoped atomic call", async () => {
    const insertCards = okInsert();
    const r = await handleSaveRequest({
      userId: "u1",
      body: {
        cards: [
          { front: "Q1", back: "A1" },
          { front: "Q2", back: "A2" },
        ],
      },
      insertCards,
    });
    expect(r).toEqual({ status: 201, body: { saved: 2 } });
    expect(insertCards).toHaveBeenCalledTimes(1);
    expect(insertCards).toHaveBeenCalledWith([
      { user_id: "u1", front: "Q1", back: "A1", source: "ai" },
      { user_id: "u1", front: "Q2", back: "A2", source: "ai" },
    ]);
  });

  it("returns 500 when the insert fails (nothing saved)", async () => {
    const insertCards = vi.fn<Insert>().mockResolvedValue({ error: new Error("db") });
    const r = await handleSaveRequest({ userId: "u1", body: { cards: [{ front: "Q", back: "A" }] }, insertCards });
    expect(r.status).toBe(500);
  });
});
