import { describe, it, expect, vi } from "vitest";
import { handleUpdateCard, handleDeleteCard } from "@/lib/deck-mutations";

type Update = (id: string, patch: { front: string; back: string }) => Promise<{ ok: boolean; found: boolean }>;
type Delete = (id: string) => Promise<{ ok: boolean; found: boolean }>;

const VALID = { front: "Q", back: "A" };

describe("handleUpdateCard (S-03)", () => {
  it("401 without a user", async () => {
    const updateCard = vi.fn<Update>();
    const r = await handleUpdateCard({ userId: null, id: "c1", body: VALID, updateCard });
    expect(r.status).toBe(401);
    expect(updateCard).not.toHaveBeenCalled();
  });

  it("400 when the route supplied no id", async () => {
    // The endpoint passes `params.id ?? ""` — a missing segment must not reach the DB.
    const updateCard = vi.fn<Update>();
    const r = await handleUpdateCard({ userId: "u1", id: "", body: VALID, updateCard });
    expect(r.status).toBe(400);
    expect(updateCard).not.toHaveBeenCalled();
  });

  it("400 on a malformed body", async () => {
    const updateCard = vi.fn<Update>().mockResolvedValue({ ok: true, found: true });
    const r = await handleUpdateCard({ userId: "u1", id: "c1", body: { front: "" }, updateCard });
    expect(r.status).toBe(400);
  });

  it("404 when no owned row matched", async () => {
    const updateCard = vi.fn<Update>().mockResolvedValue({ ok: true, found: false });
    const r = await handleUpdateCard({ userId: "u1", id: "c1", body: VALID, updateCard });
    expect(r.status).toBe(404);
  });

  it("500 on a DB error", async () => {
    const updateCard = vi.fn<Update>().mockResolvedValue({ ok: false, found: false });
    const r = await handleUpdateCard({ userId: "u1", id: "c1", body: VALID, updateCard });
    expect(r.status).toBe(500);
  });

  it("200 on a successful owned update", async () => {
    const updateCard = vi.fn<Update>().mockResolvedValue({ ok: true, found: true });
    const r = await handleUpdateCard({ userId: "u1", id: "c1", body: VALID, updateCard });
    expect(r).toEqual({ status: 200, body: { updated: true } });
    expect(updateCard).toHaveBeenCalledWith("c1", VALID);
  });
});

describe("handleDeleteCard (S-03)", () => {
  it("401 without a user", async () => {
    const deleteCard = vi.fn<Delete>();
    const r = await handleDeleteCard({ userId: null, id: "c1", deleteCard });
    expect(r.status).toBe(401);
    expect(deleteCard).not.toHaveBeenCalled();
  });

  it("400 when the route supplied no id", async () => {
    const deleteCard = vi.fn<Delete>();
    const r = await handleDeleteCard({ userId: "u1", id: "", deleteCard });
    expect(r.status).toBe(400);
    expect(deleteCard).not.toHaveBeenCalled();
  });

  it("404 when no owned row matched", async () => {
    const deleteCard = vi.fn<Delete>().mockResolvedValue({ ok: true, found: false });
    const r = await handleDeleteCard({ userId: "u1", id: "c1", deleteCard });
    expect(r.status).toBe(404);
  });

  it("500 on a DB error", async () => {
    const deleteCard = vi.fn<Delete>().mockResolvedValue({ ok: false, found: false });
    const r = await handleDeleteCard({ userId: "u1", id: "c1", deleteCard });
    expect(r.status).toBe(500);
  });

  it("200 on a successful owned delete", async () => {
    const deleteCard = vi.fn<Delete>().mockResolvedValue({ ok: true, found: true });
    const r = await handleDeleteCard({ userId: "u1", id: "c1", deleteCard });
    expect(r).toEqual({ status: 200, body: { deleted: true } });
  });
});
