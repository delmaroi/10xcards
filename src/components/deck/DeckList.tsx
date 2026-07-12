import { useState } from "react";
import { cn } from "@/lib/utils";

// Interactive deck (S-03): browse + inline edit + delete. Seeded with SSR-fetched cards.
interface Card {
  id: string;
  front: string;
  back: string;
}

export function DeckList({ cards: initial }: { cards: Card[] }) {
  const [cards, setCards] = useState<Card[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(c: Card) {
    setEditingId(c.id);
    setDraft({ front: c.front, back: c.back });
    setError(null);
  }

  async function save(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/flashcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        setError("Save failed — try again.");
        return;
      }
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, front: draft.front, back: draft.back } : c)));
      setEditingId(null);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this card?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/flashcards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed — try again.");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (cards.length === 0) {
    return (
      <p className="opacity-70">
        No cards yet.{" "}
        <a className="underline" href="/generate">
          Generate some
        </a>
        .
      </p>
    );
  }

  const inputClass = "rounded border border-white/15 bg-transparent p-2 text-sm";
  const btnClass = "rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10";

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li key={c.id} className="rounded-md border border-white/20 p-3">
            {editingId === c.id ? (
              <div className="flex flex-col gap-2">
                <input
                  aria-label="Question"
                  className={inputClass}
                  value={draft.front}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, front: e.target.value }));
                  }}
                />
                <input
                  aria-label="Answer"
                  className={inputClass}
                  value={draft.back}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, back: e.target.value }));
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(btnClass, busyId === c.id && "opacity-50")}
                    disabled={busyId === c.id}
                    onClick={() => void save(c.id)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={btnClass}
                    onClick={() => {
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{c.front}</p>
                <p className="text-sm opacity-80">{c.back}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnClass}
                    onClick={() => {
                      startEdit(c);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={cn(btnClass, busyId === c.id && "opacity-50")}
                    disabled={busyId === c.id}
                    onClick={() => void remove(c.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
