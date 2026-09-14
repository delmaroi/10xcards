import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlashcardBrowseCard } from "@/components/sets/FlashcardBrowseCard";
import { Button } from "@/components/ui/button";
import { useReverseMode } from "@/components/hooks/useReverseMode";
import { I18nProvider } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";
import type { SupportedLocale } from "@/lib/i18n/constants";
import type { VoiceId } from "@/lib/tts/voices";
import type { Flashcard } from "@/types";

interface Props {
  setId: string;
  setName: string;
  flashcards: Flashcard[];
  locale: SupportedLocale;
  voiceFront: VoiceId;
  voiceBack: VoiceId;
}

export default function FlashcardBrowseView({ locale, ...props }: Props) {
  return (
    <I18nProvider locale={locale}>
      <FlashcardBrowseViewInner {...props} />
    </I18nProvider>
  );
}

function FlashcardBrowseViewInner({ setId, setName, flashcards, voiceFront, voiceBack }: Omit<Props, "locale">) {
  const { t } = useTranslation("common");
  const [reverse] = useReverseMode(setId);
  const [order, setOrder] = useState<number[]>(() => flashcards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(reverse);

  const currentCard = flashcards[order[position]];
  const isFirst = position === 0;
  const isLast = position === order.length - 1;

  const goNext = useCallback(() => {
    setPosition((p) => {
      if (p < order.length - 1) {
        setFlipped(reverse);
        return p + 1;
      }
      return p;
    });
  }, [order.length, reverse]);

  const goPrev = useCallback(() => {
    setPosition((p) => {
      if (p > 0) {
        setFlipped(reverse);
        return p - 1;
      }
      return p;
    });
  }, [reverse]);

  const flip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const shuffle = useCallback(() => {
    const arr = flashcards.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
    setPosition(0);
    setFlipped(reverse);
  }, [flashcards, reverse]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [goNext, goPrev, flip]);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!currentCard) return null;

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
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={shuffle}
          >
            <ShuffleIcon />
            {t("browse.shuffle")}
          </Button>
        </div>

        <div className="flex flex-col items-center gap-6">
          <FlashcardBrowseCard
            key={currentCard.id}
            front={currentCard.front}
            back={currentCard.back}
            flipped={flipped}
            onFlip={flip}
            voiceFront={voiceFront}
            voiceBack={voiceBack}
          />

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className={cn("gap-1 text-white hover:bg-white/10", isFirst && "cursor-not-allowed opacity-30")}
              onClick={goPrev}
              disabled={isFirst}
              aria-label={t("browse.previous")}
            >
              <ChevronLeftIcon />
              {t("browse.previous")}
            </Button>

            <p className="min-w-[4rem] text-center text-sm text-blue-100/40">
              {position + 1} / {flashcards.length}
            </p>

            <Button
              variant="ghost"
              className={cn("gap-1 text-white hover:bg-white/10", isLast && "cursor-not-allowed opacity-30")}
              onClick={goNext}
              disabled={isLast}
              aria-label={t("browse.next")}
            >
              {t("browse.next")}
              <ChevronRightIcon />
            </Button>
          </div>

          <p className="text-xs text-blue-100/30">← → navigate · Space flip</p>
        </div>
      </div>
    </div>
  );
}

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

function ShuffleIcon() {
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
      className="mr-1"
    >
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.7l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
