import { z } from "zod";

const GCP_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
export const TTS_REQUEST_TIMEOUT_MS = 10_000;

// Never-throw result union, mirroring `ai.ts` (AiServiceError). The route maps
// `kind` → HTTP status via the static table below.
export type TtsServiceError =
  | { kind: "unconfigured"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "apiError"; message: string };

const HTTP_STATUS_BY_TTS_ERROR_KIND: Record<TtsServiceError["kind"], number> = {
  unconfigured: 500,
  apiError: 502,
  timeout: 504,
};

export function getTtsErrorHttpStatus(error: TtsServiceError): number {
  return HTTP_STATUS_BY_TTS_ERROR_KIND[error.kind];
}

export function ttsErrorMessage(error: TtsServiceError): string {
  return error.message;
}

export interface SynthesizeInput {
  text: string;
  gcpVoice: string;
  languageCode: string;
  apiKey: string;
}

// Google Cloud TTS returns `{ audioContent: "<base64>" }`.
const synthesizeResponseSchema = z.object({
  audioContent: z.string().min(1),
});

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Env-agnostic Google Cloud Text-to-Speech synthesis. The API key is passed in
// (the route owns the secret), so this is directly testable. Uses API-key auth
// (`?key=`) to avoid JWT signing in the Worker. Checks `response.ok` before
// parsing (lessons: scraper/provider must guard non-200 before consuming body).
export async function synthesizeSpeech(
  input: SynthesizeInput,
): Promise<{ data: Uint8Array | null; error: TtsServiceError | null }> {
  const { text, gcpVoice, languageCode, apiKey } = input;

  if (!apiKey) {
    return { data: null, error: { kind: "unconfigured", message: "Google TTS API key is not configured" } };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TTS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GCP_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: gcpVoice },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return {
        data: null,
        error: {
          kind: "apiError",
          message: `Google TTS request failed (${response.status}): ${bodyText.slice(0, 200)}`,
        },
      };
    }

    const raw = await response.json();
    const parsed = synthesizeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return { data: null, error: { kind: "apiError", message: "Google TTS returned an unexpected response format" } };
    }

    return { data: base64ToBytes(parsed.data.audioContent), error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: null, error: { kind: "timeout", message: "Speech synthesis timed out" } };
    }
    return {
      data: null,
      error: { kind: "apiError", message: error instanceof Error ? error.message : "Unknown error calling Google TTS" },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
