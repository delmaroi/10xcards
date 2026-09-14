/// <reference types="@cloudflare/workers-types" />

const HOURLY_LIMIT = process.env.AI_RATE_LIMIT_HOURLY ? parseInt(process.env.AI_RATE_LIMIT_HOURLY, 10) : 10;

export function getHourlyLimit(): number {
  return Number.isNaN(HOURLY_LIMIT) ? 10 : HOURLY_LIMIT;
}

export function rateLimitKey(userId: string, now = new Date()): string {
  const hour = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return `ai:hourly:${userId}:${hour}`;
}

export async function checkRateLimit(
  kv: KVNamespace | null,
  userId: string,
  now = new Date(),
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const limit = getHourlyLimit();
  if (!kv) {
    return { allowed: false, limit, remaining: 0 };
  }

  const key = rateLimitKey(userId, now);
  const current = await kv.get(key);
  const parsed = current ? Number.parseInt(current, 10) : 0;
  const count = Number.isNaN(parsed) ? 0 : parsed;

  if (count >= limit) {
    return { allowed: false, limit, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: 3600 });
  return { allowed: true, limit, remaining: limit - count - 1 };
}

// Dictionary endpoint rate limiting. Separate contract from checkRateLimit:
// minute-granularity buckets (vs hourly), a `dict:minute:` key prefix, and a
// 60s TTL. Reuses the same AI_RATE_LIMIT KV namespace — no new binding.
const DICT_LIMIT_PER_MINUTE = 30;

export function getDictLimit(): number {
  return DICT_LIMIT_PER_MINUTE;
}

export function dictRateLimitKey(userId: string, now = new Date()): string {
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `dict:minute:${userId}:${minute}`;
}

export async function checkDictRateLimit(
  kv: KVNamespace | null,
  userId: string,
  now = new Date(),
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const limit = getDictLimit();
  if (!kv) {
    return { allowed: false, limit, remaining: 0 };
  }

  const key = dictRateLimitKey(userId, now);
  const current = await kv.get(key);
  const parsed = current ? Number.parseInt(current, 10) : 0;
  const count = Number.isNaN(parsed) ? 0 : parsed;

  if (count >= limit) {
    return { allowed: false, limit, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return { allowed: true, limit, remaining: limit - count - 1 };
}

// TTS endpoint rate limiting. Same contract as checkDictRateLimit: minute
// buckets, a `tts:minute:` key prefix, 60s TTL. Reuses the AI_RATE_LIMIT KV
// namespace — no new binding. Cache hits are checked BEFORE this gate (see
// api/tts.ts) so replays neither consume quota nor count against the limit.
const TTS_LIMIT_PER_MINUTE = 60;

export function getTtsLimit(): number {
  return TTS_LIMIT_PER_MINUTE;
}

export function ttsRateLimitKey(userId: string, now = new Date()): string {
  const minute = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `tts:minute:${userId}:${minute}`;
}

export async function checkTtsRateLimit(
  kv: KVNamespace | null,
  userId: string,
  now = new Date(),
): Promise<{ allowed: boolean; limit: number; remaining: number }> {
  const limit = getTtsLimit();
  if (!kv) {
    return { allowed: false, limit, remaining: 0 };
  }

  const key = ttsRateLimitKey(userId, now);
  const current = await kv.get(key);
  const parsed = current ? Number.parseInt(current, 10) : 0;
  const count = Number.isNaN(parsed) ? 0 : parsed;

  if (count >= limit) {
    return { allowed: false, limit, remaining: 0 };
  }

  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return { allowed: true, limit, remaining: limit - count - 1 };
}
