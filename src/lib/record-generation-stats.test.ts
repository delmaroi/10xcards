import { describe, it, expect, vi } from "vitest";
import { handleRecordStats, type GenerationStatRow } from "@/lib/record-generation-stats";

type Insert = (row: GenerationStatRow) => Promise<{ error: unknown }>;
const okInsert = () => vi.fn<Insert>().mockResolvedValue({ error: null });

describe("handleRecordStats (S-04 metrics capture)", () => {
  it("returns 401 with no user", async () => {
    const insertStat = okInsert();
    const r = await handleRecordStats({ userId: null, body: { generated: 3, accepted: 2, edited: 1 }, insertStat });
    expect(r.status).toBe(401);
    expect(insertStat).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed body", async () => {
    const r = await handleRecordStats({ userId: "u1", body: { generated: "x" }, insertStat: okInsert() });
    expect(r.status).toBe(400);
  });

  it("returns 400 on impossible counts (accepted > generated)", async () => {
    const r = await handleRecordStats({
      userId: "u1",
      body: { generated: 2, accepted: 3, edited: 0 },
      insertStat: okInsert(),
    });
    expect(r.status).toBe(400);
  });

  it("returns 400 when edited > accepted", async () => {
    const r = await handleRecordStats({
      userId: "u1",
      body: { generated: 5, accepted: 2, edited: 3 },
      insertStat: okInsert(),
    });
    expect(r.status).toBe(400);
  });

  it("records an owner-scoped row and returns 201", async () => {
    const insertStat = okInsert();
    const r = await handleRecordStats({ userId: "u1", body: { generated: 4, accepted: 3, edited: 1 }, insertStat });
    expect(r).toEqual({ status: 201, body: { recorded: true } });
    expect(insertStat).toHaveBeenCalledWith({ user_id: "u1", generated: 4, accepted: 3, edited: 1 });
  });

  it("returns 500 when the insert fails", async () => {
    const insertStat = vi.fn<Insert>().mockResolvedValue({ error: new Error("db") });
    const r = await handleRecordStats({ userId: "u1", body: { generated: 1, accepted: 1, edited: 0 }, insertStat });
    expect(r.status).toBe(500);
  });
});
