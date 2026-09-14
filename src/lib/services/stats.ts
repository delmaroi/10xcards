import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyStats, LearningStats, RecentSetStats } from "@/types";
import type { ServiceError } from "./flashcards";

interface SetRow {
  id: string;
  name: string;
  last_opened_at: string;
}

interface SessionRow {
  started_at: string;
  ended_at: string;
}

interface FlashcardRow {
  set_id: string;
}

export async function logSession(
  client: SupabaseClient | null,
  userId: string,
  setId: string,
  startedAt: Date,
  endedAt: Date,
): Promise<{ error: ServiceError | null }> {
  if (!client) return { error: { kind: "clientUnavailable", message: "Supabase client not available" } };

  // Ownership gate: session_log's RLS only checks auth.uid() = user_id, so
  // without this check a caller could log a session against another user's
  // set_id (a cross-user reference RLS never catches). Mirror the sibling
  // services (reviews/flashcards) and hide non-owned sets as not-found.
  const ownership = await client.from("sets").select("id").eq("id", setId).eq("user_id", userId).maybeSingle();
  if (ownership.error) return { error: { kind: "dbError", message: ownership.error.message } };
  if (!ownership.data) return { error: { kind: "notFound", message: "Set not found" } };

  const { error } = await client.from("session_log").insert({
    user_id: userId,
    set_id: setId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
  });
  if (error) return { error: { kind: "dbError", message: error.message } };
  return { error: null };
}

export async function getSetActivity(
  client: SupabaseClient,
  userId: string,
  setId: string,
): Promise<{ data: DailyStats[] | null; error: string | null }> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 13);
  cutoff.setUTCHours(0, 0, 0, 0);

  const { data: rawSessions, error: sessionsError } = await client
    .from("session_log")
    .select("started_at, ended_at")
    .eq("user_id", userId)
    .eq("set_id", setId)
    .gte("started_at", cutoff.toISOString());

  if (sessionsError) return { data: null, error: sessionsError.message };

  const sessions = (Array.isArray(rawSessions) ? rawSessions : []) as SessionRow[];
  const minutesByDay = new Map<string, number>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    const mins = Math.ceil((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + mins);
  }

  const dailyMinutes: DailyStats[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    dailyMinutes.push({ day, minutes: minutesByDay.get(day) ?? 0 });
  }

  return { data: dailyMinutes, error: null };
}

export async function getLearningStats(
  client: SupabaseClient,
  userId: string,
): Promise<{ data: LearningStats | null; error: string | null }> {
  const { data: rawSets, error: setsError } = await client
    .from("sets")
    .select("id, name, last_opened_at")
    .eq("user_id", userId)
    .not("last_opened_at", "is", null)
    .order("last_opened_at", { ascending: false })
    .limit(3);

  if (setsError) return { data: null, error: setsError.message };

  const recentSets = (Array.isArray(rawSets) ? rawSets : []) as SetRow[];
  const recentSetIds = recentSets.map((s) => s.id);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 13);
  cutoff.setUTCHours(0, 0, 0, 0);

  const { data: rawSessions, error: sessionsError } = await client
    .from("session_log")
    .select("started_at, ended_at")
    .eq("user_id", userId)
    .gte("started_at", cutoff.toISOString());

  if (sessionsError) return { data: null, error: sessionsError.message };

  const sessions = (Array.isArray(rawSessions) ? rawSessions : []) as SessionRow[];
  const minutesByDay = new Map<string, number>();
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    const mins = Math.ceil((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + mins);
  }

  const dailyMinutes: DailyStats[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    dailyMinutes.push({ day, minutes: minutesByDay.get(day) ?? 0 });
  }

  if (recentSetIds.length === 0) {
    return { data: { dailyMinutes, recentSets: [] }, error: null };
  }

  const [totalResult, learnedResult] = await Promise.all([
    client.from("flashcards").select("set_id").in("set_id", recentSetIds).limit(2000),
    client.from("flashcards").select("set_id").in("set_id", recentSetIds).eq("state", 2).limit(2000),
  ]);

  if (totalResult.error) return { data: null, error: totalResult.error.message };
  if (learnedResult.error) return { data: null, error: learnedResult.error.message };

  const totalRows = (Array.isArray(totalResult.data) ? totalResult.data : []) as FlashcardRow[];
  const learnedRows = (Array.isArray(learnedResult.data) ? learnedResult.data : []) as FlashcardRow[];

  const totalBySet = new Map<string, number>();
  const learnedBySet = new Map<string, number>();
  for (const row of totalRows) {
    totalBySet.set(row.set_id, (totalBySet.get(row.set_id) ?? 0) + 1);
  }
  for (const row of learnedRows) {
    learnedBySet.set(row.set_id, (learnedBySet.get(row.set_id) ?? 0) + 1);
  }

  const recentSetStats: RecentSetStats[] = recentSets.map((s) => ({
    id: s.id,
    name: s.name,
    last_opened_at: s.last_opened_at,
    total_flashcards: totalBySet.get(s.id) ?? 0,
    learned_count: learnedBySet.get(s.id) ?? 0,
  }));

  return { data: { dailyMinutes, recentSets: recentSetStats }, error: null };
}
