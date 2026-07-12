import { useState } from "react";
import { cn } from "@/lib/utils";

// Review session island (S-04): walk the due queue one card at a time —
// show front → reveal back → rate. Each rating POSTs to the submit-rating endpoint,
// then advances. Finishes when the queue is empty.
interface Card {
  id: string;
  front: string;
  back: string;
}

// Rating values map to ts-fsrs Grade: Again=1, Hard=2, Good=3, Easy=4.
const RATINGS = [
  { label: "Again", value: 1 },
  { label: "Hard", value: 2 },
  { label: "Good", value: 3 },
  { label: "Easy", value: 4 },
] as const;

export function ReviewSession({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = cards.length;
  const done = index >= total;
  const card = cards[index];

  async function rate(value: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/review/submit-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, rating: value }),
      });
      if (!res.ok) {
        setError("Could not save your rating — try again.");
        return;
      }
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (total === 0) {
    return (
      <p className="opacity-70">
        Nothing due right now. Nice work.{" "}
        <a className="underline" href="/deck">
          Back to your deck
        </a>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-lg font-medium">Session complete — {total} reviewed. 🎉</p>
        <a className="underline" href="/deck">
          Back to your deck
        </a>
      </div>
    );
  }

  const btnClass = "rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/10";

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-sm opacity-60">
        Card {index + 1} of {total}
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-md border border-white/20 p-4">
        <p className="text-lg font-medium">{card.front}</p>
        {revealed && <p className="mt-3 border-t border-white/15 pt-3 text-base opacity-90">{card.back}</p>}
      </div>

      {revealed ? (
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={cn(btnClass, busy && "opacity-50")}
              disabled={busy}
              onClick={() => void rate(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          className={btnClass}
          onClick={() => {
            setRevealed(true);
          }}
        >
          Show answer
        </button>
      )}
    </div>
  );
}
