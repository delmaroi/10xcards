import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SUPPORTED_VOICES, type VoiceId } from "@/lib/tts/voices";

interface Props {
  initialFront: VoiceId;
  initialBack: VoiceId;
}

export function VoiceSwitcher({ initialFront, initialBack }: Props) {
  const { t } = useTranslation("settings");
  const [front, setFront] = useState<VoiceId>(initialFront);
  const [back, setBack] = useState<VoiceId>(initialBack);
  const [saving, setSaving] = useState(false);

  async function persist(next: { front: VoiceId; back: VoiceId }, prev: { front: VoiceId; back: VoiceId }) {
    setSaving(true);
    try {
      const res = await fetch("/api/user-voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        toast.success(t("settings.voiceSaved"));
      } else {
        // Roll back the optimistic selection so the dropdowns reflect the
        // last persisted value rather than an unsaved one.
        setFront(prev.front);
        setBack(prev.back);
        toast.error(t("settings.voiceSaveFailed"));
      }
    } catch {
      setFront(prev.front);
      setBack(prev.back);
      toast.error(t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  function handleChange(side: "front" | "back", value: VoiceId) {
    const prev = { front, back };
    const next = side === "front" ? { front: value, back } : { front, back: value };
    if (side === "front") {
      setFront(value);
    } else {
      setBack(value);
    }
    void persist(next, prev);
  }

  const selectClass =
    "w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white disabled:opacity-50";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="voice-front" className="text-sm text-blue-100/70">
          {t("settings.voiceFront")}
        </label>
        <select
          id="voice-front"
          data-testid="voice-front"
          value={front}
          disabled={saving}
          onChange={(e) => {
            handleChange("front", e.target.value as VoiceId);
          }}
          className={selectClass}
        >
          {SUPPORTED_VOICES.map((voice) => (
            <option key={voice.id} value={voice.id} className="bg-[#0f1529] text-white">
              {voice.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="voice-back" className="text-sm text-blue-100/70">
          {t("settings.voiceBack")}
        </label>
        <select
          id="voice-back"
          data-testid="voice-back"
          value={back}
          disabled={saving}
          onChange={(e) => {
            handleChange("back", e.target.value as VoiceId);
          }}
          className={selectClass}
        >
          {SUPPORTED_VOICES.map((voice) => (
            <option key={voice.id} value={voice.id} className="bg-[#0f1529] text-white">
              {voice.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
