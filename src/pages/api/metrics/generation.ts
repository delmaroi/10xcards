import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { handleRecordStats } from "@/lib/record-generation-stats";

export const POST: APIRoute = async (context) => {
  let body: unknown = null;
  try {
    body = await context.request.json();
  } catch {
    body = null;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  const result = await handleRecordStats({
    userId: context.locals.user?.id ?? null,
    body,
    // RLS with-check enforces owner; user_id is set from the session in the handler.
    insertStat: async (row) => {
      if (!supabase) return { error: new Error("no client") };
      const { error } = await supabase.from("generation_stats").insert(row);
      return { error };
    },
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
};
