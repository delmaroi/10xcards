// Curated static registry of text-to-speech voices, mirroring
// `src/lib/i18n/constants.ts`. Single source of truth for the Settings
// dropdowns, the `/api/user-voice` + `/api/tts` validation, and the Google
// Cloud TTS request. `id` is the app-facing value persisted per account;
// `gcpVoice` is the Google Cloud voice `name` sent to the synthesis API.

export interface Voice {
  /** App-facing id persisted in `user_preferences.tts_voice_{front,back}`. */
  id: string;
  /** Human-readable label shown in the Settings dropdowns. */
  label: string;
  /** BCP-47 language code sent to Google Cloud TTS (`voice.languageCode`). */
  languageCode: string;
  /** Google Cloud voice `name` (e.g. `en-US-Neural2-C`) sent as `voice.name`. */
  gcpVoice: string;
}

// Ordered: the first entry is DEFAULT_VOICE and MUST be an en-US voice.
export const SUPPORTED_VOICES = [
  { id: "en-US-female", label: "English (US) — Female", languageCode: "en-US", gcpVoice: "en-US-Neural2-C" },
  { id: "en-US-male", label: "English (US) — Male", languageCode: "en-US", gcpVoice: "en-US-Neural2-D" },
  { id: "de-DE-female", label: "German — Female", languageCode: "de-DE", gcpVoice: "de-DE-Neural2-F" },
  { id: "de-DE-male", label: "German — Male", languageCode: "de-DE", gcpVoice: "de-DE-Neural2-B" },
  { id: "pl-PL-female", label: "Polish — Female", languageCode: "pl-PL", gcpVoice: "pl-PL-Wavenet-A" },
  { id: "pl-PL-male", label: "Polish — Male", languageCode: "pl-PL", gcpVoice: "pl-PL-Wavenet-B" },
  { id: "es-ES-female", label: "Spanish — Female", languageCode: "es-ES", gcpVoice: "es-ES-Neural2-A" },
  { id: "es-ES-male", label: "Spanish — Male", languageCode: "es-ES", gcpVoice: "es-ES-Neural2-B" },
  { id: "fr-FR-female", label: "French — Female", languageCode: "fr-FR", gcpVoice: "fr-FR-Neural2-A" },
  { id: "fr-FR-male", label: "French — Male", languageCode: "fr-FR", gcpVoice: "fr-FR-Neural2-B" },
] as const satisfies readonly Voice[];

export type VoiceId = (typeof SUPPORTED_VOICES)[number]["id"];

// First entry — an en-US voice — is the default for both card sides.
export const DEFAULT_VOICE: VoiceId = SUPPORTED_VOICES[0].id;

export function isValidVoice(value: string): value is VoiceId {
  return SUPPORTED_VOICES.some((v) => v.id === value);
}

export function getVoiceById(id: string): (typeof SUPPORTED_VOICES)[number] | undefined {
  return SUPPORTED_VOICES.find((v) => v.id === id);
}
