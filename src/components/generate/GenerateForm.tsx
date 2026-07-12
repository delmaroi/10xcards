import { useState } from "react";
import { cn } from "@/lib/utils";

// S-01 generation UI: paste text → POST /api/generate → triage proposals (accept/edit/reject).
// Proposals are ephemeral (client-side); persisting the accepted set is S-02.
const MIN_INPUT = 20;
const MAX_INPUT = 10_000;

type Decision = "pending" | "accepted" | "rejected";

interface Proposal {
  front: string;
  back: string;
  decision: Decision;
  edited: boolean;
}

interface GenerateResponse {
  proposals?: { front: string; back: string }[];
}

export function GenerateForm() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedLength = text.trim().length;
  const inputInvalid = trimmedLength < MIN_INPUT || trimmedLength > MAX_INPUT;
  const acceptedCount = proposals.filter((p) => p.decision === "accepted").length;

  async function handleGenerate() {
    setError(null);
    if (inputInvalid) {
      setError(`Paste between ${String(MIN_INPUT)} and ${String(MAX_INPUT)} characters.`);
      return;
    }
    setStatus("loading");
    setProposals([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        setStatus("error");
        setError(res.status === 401 ? "Please sign in to generate cards." : "Generation failed — try again.");
        return;
      }
      const data = (await res.json()) as GenerateResponse;
      setProposals(
        (data.proposals ?? []).map((p) => ({ front: p.front, back: p.back, decision: "pending", edited: false })),
      );
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Network error — try again.");
    }
  }

  function patch(index: number, next: Partial<Proposal>) {
    setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, ...next } : p)));
  }

  async function handleSave() {
    const accepted = proposals.filter((p) => p.decision === "accepted");
    if (accepted.length === 0) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: accepted.map((p) => ({ front: p.front, back: p.back })) }),
      });
      if (!res.ok) {
        setSaveStatus("error");
        setSaveError(res.status === 401 ? "Please sign in to save." : "Save failed — try again.");
        return;
      }
      setSaveStatus("saved");
      // Best-effort success-metrics capture (S-04): record the batch's triage counts.
      // A metrics failure must never affect the save UX, so it's fire-and-forget.
      void fetch("/api/metrics/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generated: proposals.length,
          accepted: accepted.length,
          edited: accepted.filter((p) => p.edited).length,
        }),
      }).catch(() => undefined);
    } catch {
      setSaveStatus("error");
      setSaveError("Network error — try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Source text</span>
        <textarea
          aria-label="Source text"
          className="min-h-40 rounded-md border border-white/20 bg-white/5 p-3 text-sm"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder="Paste your notes here…"
        />
        <span className="text-xs opacity-60">
          {trimmedLength} / {MAX_INPUT} characters
        </span>
      </label>

      <button
        type="button"
        className={cn(
          "self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20",
          (status === "loading" || inputInvalid) && "cursor-not-allowed opacity-50",
        )}
        disabled={status === "loading" || inputInvalid}
        onClick={handleGenerate}
      >
        {status === "loading" ? "Generating…" : "Generate"}
      </button>

      {status === "loading" && (
        <p role="status" className="text-sm opacity-70">
          Generating flashcards — this can take a few seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      {proposals.length > 0 && (
        <section aria-label="Generated proposals" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Proposals ({acceptedCount} accepted of {proposals.length})
          </h2>
          {proposals.map((p, i) => (
            <article
              key={i}
              className={cn(
                "flex flex-col gap-2 rounded-md border p-3",
                p.decision === "accepted" && "border-green-400/50 bg-green-400/10",
                p.decision === "rejected" && "border-white/10 bg-white/5 opacity-50",
                p.decision === "pending" && "border-white/20",
              )}
            >
              <input
                aria-label={`Proposal ${String(i + 1)} question`}
                className="rounded border border-white/15 bg-transparent p-2 text-sm"
                value={p.front}
                onChange={(e) => {
                  patch(i, { front: e.target.value, edited: true });
                }}
              />
              <input
                aria-label={`Proposal ${String(i + 1)} answer`}
                className="rounded border border-white/15 bg-transparent p-2 text-sm"
                value={p.back}
                onChange={(e) => {
                  patch(i, { back: e.target.value, edited: true });
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
                  onClick={() => {
                    patch(i, { decision: "accepted" });
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
                  onClick={() => {
                    patch(i, { decision: "rejected" });
                  }}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}

          {/* Atomic save of the accepted set to the deck (S-02). */}
          <button
            type="button"
            className={cn(
              "self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20",
              (acceptedCount === 0 || saveStatus === "saving") && "cursor-not-allowed opacity-50",
            )}
            disabled={acceptedCount === 0 || saveStatus === "saving"}
            onClick={handleSave}
          >
            {saveStatus === "saving" ? "Saving…" : `Save ${acceptedCount} to deck`}
          </button>
          {saveStatus === "saved" && (
            <p role="status" className="text-sm text-green-300">
              Saved.{" "}
              <a className="underline" href="/deck">
                View your deck
              </a>
            </p>
          )}
          {saveStatus === "error" && saveError && (
            <p role="alert" className="text-sm text-red-300">
              {saveError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
