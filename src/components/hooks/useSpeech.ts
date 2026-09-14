import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceId } from "@/lib/tts/voices";

export type SpeechStatus = "idle" | "loading" | "error";

/**
 * Text-to-speech playback for a single card side. Calls `POST /api/tts`,
 * turns the returned MP3 bytes into an object URL, and plays it via `Audio`.
 *
 * A single in-flight request/playback is tracked at a time: calling `speak`
 * again (or unmounting) aborts the pending fetch, stops any current audio, and
 * revokes the previous object URL so nothing leaks. All `Audio` construction
 * runs client-side — consuming islands are mounted `client:only="react"`.
 *
 * `status` is `loading` while synthesizing, `error` on a failed synthesis
 * (caller shows a toast), and `idle` otherwise. A superseding `speak` call or
 * an unmount abort is not an error and does not flip `status` to `error`.
 */
export function useSpeech(): { speak: (text: string, voice: VoiceId) => Promise<void>; status: SpeechStatus } {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  // Stop playback and free resources on unmount.
  useEffect(() => cleanup, [cleanup]);

  const speak = useCallback(
    async (text: string, voice: VoiceId) => {
      // Abort/replace any in-flight synthesis or playback before starting.
      cleanup();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("TTS request failed");
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.addEventListener("ended", () => {
          setStatus("idle");
          // Free the object URL as soon as playback finishes naturally, rather
          // than waiting for the next speak() or unmount to revoke it.
          if (urlRef.current === url) {
            URL.revokeObjectURL(url);
            urlRef.current = null;
            audioRef.current = null;
          }
        });
        await audio.play();
        setStatus("idle");
      } catch (err) {
        // A superseding speak() call or unmount aborted us — not an error.
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        setStatus("error");
      }
    },
    [cleanup],
  );

  return { speak, status };
}
