import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false;

const bodySchema = z.object({ token: z.uuid() });

interface ClaimRow {
  cloned_set_id: string;
  already_claimed: boolean;
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  if (!user?.id || !supabase) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid token format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rpcResult = await supabase.rpc("claim_shared_set", { p_token: parsed.data.token });

  if (rpcResult.error) {
    const msg = rpcResult.error.message;
    const status = msg.includes("Share token not found") ? 404 : msg.includes("Not authenticated") ? 401 : 400;
    return new Response(JSON.stringify({ error: rpcResult.error.message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = rpcResult.data as ClaimRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "Unexpected RPC response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const row = rows[0];
  return new Response(JSON.stringify({ cloned_set_id: row.cloned_set_id, already_claimed: row.already_claimed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
