import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Rating } from "@/types";
import type { Flashcard, SessionSummary } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FlashcardBrowseCard } from "@/components/sets/FlashcardBrowseCard";
import { useReverseMode } from "@/components/hooks/useReverseMode";
import { I18nProvider } from "@/components/I18nProvider";
import type { SupportedLocale } from "@/lib/i18n/constants";
import type { VoiceId } from "@/lib/tts/voices";
import { ResetProgressDialog } from "@/components/review/ResetProgressDialog";

type Phase = "loading" | "empty" | "error" | "reviewing" | "summary";

interface Props {
  setId: string;
  setName: string;
  locale: SupportedLocale;
  voiceFront: VoiceId;
  voiceBack: VoiceId;
}

const GRADE_LABELS: { rating: Rating; label: string; key: keyof SessionSummary["byGrade"] }[] = [
  { rating: Rating.Again, label: "Nie wiem", key: "again" },
  { rating: Rating.Hard, label: "Trudne", key: "hard" },
  { rating: Rating.Good, label: "Wiem", key: "good" },
  { rating: Rating.Easy, label: "Łatwe", key: "easy" },
];

function BackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}

export default function ReviewSession({ locale, ...props }: Props) {
  return (
    <I18nProvider locale={locale}>
      <ReviewSessionInner {...props} />
    </I18nProvider>
  );
}

function ReviewSessionInner({ setId, setName, voiceFront, voiceBack }: Omit<Props, "locale">) {
  const { t } = useTranslation("common");
  const [reverse] = useReverseMode(setId);
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showingBack, setShowingBack] = useState(reverse);
  const [submitting, setSubmitting] = useState(false);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [summary, setSummary] = useState<SessionSummary>({
    total: 0,
    byGrade: { again: 0, hard: 0, good: 0, easy: 0 },
  });
  const sessionStartedAtRef = useRef<Date | null>(null);
  useEffect(() => {
    sessionStartedAtRef.current = new Date();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/sets/${setId}/due-cards`);
        if (!res.ok) throw new Error("Failed to load cards");
        const bodyRaw: unknown = await res.json();
        const body = bodyRaw as { cards: Flashcard[]; nextDue: string | null };
        if (cancelled) return;
        if (body.cards.length === 0) {
          setNextDue(body.nextDue);
          setPhase("empty");
        } else {
          setCards(body.cards);
          setSummary({ total: body.cards.length, byGrade: { again: 0, hard: 0, good: 0, easy: 0 } });
          setPhase("reviewing");
        }
      } catch {
        if (cancelled) return;
        setPhase("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [setId, retryCount]);

  const handleRate = useCallback(
    async (rating: Rating, gradeKey: keyof SessionSummary["byGrade"]) => {
      if (submitting) return;
      setSubmitting(true);
      const card = cards[currentIndex];
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flashcardId: card.id, grade: rating }),
        });
        if (!res.ok) throw new Error("Submit failed");

        setSummary((prev) => ({
          ...prev,
          byGrade: { ...prev.byGrade, [gradeKey]: prev.byGrade[gradeKey] + 1 },
        }));

        const nextIdx = currentIndex + 1;
        if (nextIdx >= cards.length) {
          // best-effort: session loss on network error is acceptable
          void fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              setId,
              startedAt: (sessionStartedAtRef.current ?? new Date()).toISOString(),
              endedAt: new Date().toISOString(),
            }),
          });
          setPhase("summary");
        } else {
          setCurrentIndex(nextIdx);
          setRevealed(false);
          setShowingBack(reverse);
        }
      } catch {
        toast.error("Nie udało się zapisać oceny. Spróbuj jeszcze raz.");
      } finally {
        setSubmitting(false);
      }
    },
    [cards, currentIndex, submitting, setId, reverse],
  );

  const handleReset = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/sets/${setId}/reset-progress`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      // Reload the session from a clean slate. Order matters: clear the view
      // state first, then bump retryCount so the load effect repopulates cards.
      setCurrentIndex(0);
      setRevealed(false);
      setShowingBack(reverse);
      setPhase("loading");
      setRetryCount((n) => n + 1);
      setResetOpen(false);
      toast.success(t("set.resetProgressSuccess"));
    } catch {
      toast.error(t("set.resetProgressError"));
    } finally {
      setResetting(false);
    }
  }, [resetting, setId, reverse, t]);

  // Reveal the answer side on first flip, then toggle faces on subsequent flips.
  // Shared by the keyboard handler, the card click, and the "Pokaż odpowiedź" button
  // so the three stay in lockstep.
  const flipCard = useCallback(() => {
    if (!revealed) {
      setRevealed(true);
      setShowingBack(!reverse);
    } else {
      setShowingBack((s) => !s);
    }
  }, [revealed, reverse]);

  useEffect(() => {
    if (phase !== "reviewing") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("button, input")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flipCard();
      } else if (revealed && !submitting) {
        const idx = ["1", "2", "3", "4"].indexOf(e.key);
        if (idx !== -1) {
          void handleRate(GRADE_LABELS[idx].rating, GRADE_LABELS[idx].key);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [phase, revealed, submitting, handleRate, flipCard]);

  if (phase === "loading") {
    return (
      <div className="bg-cosmic flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="bg-cosmic flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-white">
        <h1 className="text-2xl font-bold">{setName}</h1>
        <p className="text-lg text-red-400">Nie udało się załadować kart</p>
        <Button
          onClick={() => {
            setPhase("loading");
            setRetryCount((n) => n + 1);
          }}
          className="bg-white/10 text-white hover:bg-white/20"
          variant="outline"
        >
          Spróbuj ponownie
        </Button>
        <a href={`/sets/${setId}`} className="text-sm text-blue-100/50 transition-colors hover:text-blue-100/80">
          Wróć do zestawu
        </a>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div className="bg-cosmic flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-white">
        <h1 className="text-2xl font-bold">{setName}</h1>
        <p className="text-lg text-blue-100/60">Brak kart do powtórki</p>
        {nextDue && (
          <p className="text-sm text-blue-100/40">
            Następna powtórka: <span className="text-blue-100/70">{formatDate(nextDue)}</span>
          </p>
        )}
        <a
          href={`/sets/${setId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Wróć do zestawu
        </a>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="bg-cosmic flex min-h-screen flex-col items-center justify-center gap-6 p-4 text-white">
        <h1 className="text-2xl font-bold">Sesja zakończona!</h1>
        <p className="text-blue-100/60">
          Przejrzano <span className="font-semibold text-white">{summary.total}</span> kart
        </p>
        <div className="flex gap-4">
          {GRADE_LABELS.map(({ label, key }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold">{summary.byGrade[key]}</span>
              <span className="text-xs text-blue-100/50">{label}</span>
            </div>
          ))}
        </div>
        <a
          href={`/sets/${setId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Wróć do zestawu
        </a>
      </div>
    );
  }

  const card = cards[currentIndex];

  return (
    <div className="bg-cosmic min-h-screen p-4 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <a
            href={`/sets/${setId}`}
            className="inline-flex items-center gap-1 text-sm text-blue-100/50 transition-colors hover:text-blue-100/80"
          >
            <BackIcon />
            {setName}
          </a>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setResetOpen(true);
              }}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <span className="hidden sm:inline">{t("set.resetProgress")}</span>
              <span className="sm:hidden">{t("set.resetProgressShort")}</span>
            </Button>
            <span className="text-sm text-blue-100/50">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>
        </div>

        <ResetProgressDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          onConfirm={() => void handleReset()}
          pending={resetting}
        />

        <div className="flex flex-col items-center gap-6">
          <FlashcardBrowseCard
            key={card.id}
            front={card.front}
            back={card.back}
            flipped={showingBack}
            onFlip={flipCard}
            voiceFront={voiceFront}
            voiceBack={voiceBack}
          />

          <div className="flex w-full gap-2">
            {!revealed ? (
              <Button onClick={flipCard} className="w-full bg-white/10 text-white hover:bg-white/20" variant="outline">
                Pokaż odpowiedź
              </Button>
            ) : (
              GRADE_LABELS.map(({ rating, label, key }, idx) => (
                <Button
                  key={key}
                  onClick={() => handleRate(rating, key)}
                  disabled={submitting}
                  className={cn(
                    "flex-1 flex-col gap-0.5 text-sm",
                    key === "again" && "bg-red-700/80 hover:bg-red-600",
                    key === "hard" && "bg-orange-700/80 hover:bg-orange-600",
                    key === "good" && "bg-green-700/80 hover:bg-green-600",
                    key === "easy" && "bg-blue-700/80 hover:bg-blue-600",
                  )}
                >
                  {label}
                  <span className="text-[10px] opacity-60">{idx + 1}</span>
                </Button>
              ))
            )}
          </div>
          {!revealed && <p className="text-xs text-blue-100/30">Space / Enter — pokaż odpowiedź</p>}
          {revealed && <p className="text-xs text-blue-100/30">1 – 4 — oceń kartę</p>}
        </div>
      </div>
    </div>
  );
}
