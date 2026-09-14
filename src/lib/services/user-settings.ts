import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError, AuthError } from "@supabase/supabase-js";
import type { SupportedLocale } from "@/lib/i18n/constants";
import { DEFAULT_LOCALE } from "@/lib/i18n/constants";
import type { VoiceId } from "@/lib/tts/voices";
import { DEFAULT_VOICE, isValidVoice } from "@/lib/tts/voices";

interface UserPromptRow {
  id: string;
  user_id: string;
  prompt: string;
  flashcard_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserPromptData {
  prompt: string;
  flashcard_count: number | null;
}

export async function getUserPrompt(supabase: SupabaseClient, userId: string) {
  const { data, error }: { data: UserPromptRow | null; error: PostgrestError | null } = await supabase
    .from("user_ai_prompts")
    .select("prompt, flashcard_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return {
    data: { prompt: data.prompt, flashcard_count: data.flashcard_count },
    error: null,
  };
}

export async function upsertUserPrompt(
  supabase: SupabaseClient,
  userId: string,
  prompt: string,
  flashcardCount: number | null,
) {
  const { data, error }: { data: UserPromptRow | null; error: PostgrestError | null } = await supabase
    .from("user_ai_prompts")
    .upsert(
      {
        user_id: userId,
        prompt,
        flashcard_count: flashcardCount,
      },
      { onConflict: "user_id" },
    )
    .select("prompt, flashcard_count")
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return {
    data: { prompt: data.prompt, flashcard_count: data.flashcard_count },
    error: null,
  };
}

export async function deleteUserPrompt(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from("user_ai_prompts").delete().eq("user_id", userId);

  return { error };
}

export async function changePassword(supabase: SupabaseClient, newPassword: string) {
  const { error }: { error: AuthError | null } = await supabase.auth.updateUser({ password: newPassword });

  return { error };
}

export async function deleteUserAccount(adminClient: SupabaseClient, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  return { error: error as Error | null };
}

interface UserPreferencesRow {
  user_id: string;
  locale: string;
  tts_voice_front: string | null;
  tts_voice_back: string | null;
  updated_at: string;
}

function coalesceVoice(value: string | null): VoiceId {
  return value && isValidVoice(value) ? value : DEFAULT_VOICE;
}

export async function getUserLocale(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: SupportedLocale | null; error: PostgrestError | null }> {
  const { data, error }: { data: UserPreferencesRow | null; error: PostgrestError | null } = await supabase
    .from("user_preferences")
    .select("locale")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: data.locale as SupportedLocale, error: null };
}

export async function upsertUserLocale(
  supabase: SupabaseClient,
  userId: string,
  locale: SupportedLocale,
): Promise<{ data: SupportedLocale; error: PostgrestError | null }> {
  const { data, error }: { data: UserPreferencesRow | null; error: PostgrestError | null } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, locale }, { onConflict: "user_id" })
    .select("locale")
    .single();

  if (error) {
    return { data: DEFAULT_LOCALE, error };
  }

  return { data: (data?.locale ?? locale) as SupportedLocale, error: null };
}

export async function getUserVoices(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: { front: VoiceId; back: VoiceId }; error: PostgrestError | null }> {
  const {
    data,
    error,
  }: { data: Pick<UserPreferencesRow, "tts_voice_front" | "tts_voice_back"> | null; error: PostgrestError | null } =
    await supabase
      .from("user_preferences")
      .select("tts_voice_front, tts_voice_back")
      .eq("user_id", userId)
      .maybeSingle();

  if (error) {
    return { data: { front: DEFAULT_VOICE, back: DEFAULT_VOICE }, error };
  }

  return {
    data: {
      front: coalesceVoice(data?.tts_voice_front ?? null),
      back: coalesceVoice(data?.tts_voice_back ?? null),
    },
    error: null,
  };
}

export async function upsertUserVoices(
  supabase: SupabaseClient,
  userId: string,
  voices: { front: VoiceId; back: VoiceId },
): Promise<{ data: { front: VoiceId; back: VoiceId }; error: PostgrestError | null }> {
  const {
    data,
    error,
  }: { data: Pick<UserPreferencesRow, "tts_voice_front" | "tts_voice_back"> | null; error: PostgrestError | null } =
    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: userId, tts_voice_front: voices.front, tts_voice_back: voices.back },
        { onConflict: "user_id" },
      )
      .select("tts_voice_front, tts_voice_back")
      .single();

  if (error) {
    return { data: voices, error };
  }

  return {
    data: {
      front: coalesceVoice(data?.tts_voice_front ?? null),
      back: coalesceVoice(data?.tts_voice_back ?? null),
    },
    error: null,
  };
}
