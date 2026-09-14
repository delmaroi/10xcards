import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { I18nProvider } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import FlashcardProposalCard from "@/components/ai/FlashcardProposalCard";
import type { FlashcardProposal } from "@/lib/services/ai";
import { flashcardContentSchema } from "@/lib/services/flashcards";
import { saveGenerateSnapshot, saveLookupPrefill, consumeGenerateSnapshot } from "@/lib/handoff";
import type { SupportedLocale } from "@/lib/i18n/constants";

interface Props {
  setId: string;
  setName: string;
  locale: SupportedLocale;
}

interface GenerateResponse {
  flashcards: FlashcardProposal[];
  removedCount?: number;
  removedFronts?: string[];
  error?: string;
  kind?: string;
}

interface SaveResponse {
  count: number;
  skippedCount?: number;
  skippedFronts?: string[];
  error?: string;
}

const MIN_INPUT_LENGTH = 10;
const MAX_INPUT_LENGTH = 8000;
const MAX_CHECK_LENGTH = 100;

const FRIENDLY_ERROR_KINDS = ["timeout", "apiError", "unconfigured", "parseError", "noProposals", "rateLimit"];

export default function GenerateFlashcardsPage(props: Props) {
  return (
    <I18nProvider locale={props.locale}>
      <GenerateFlashcardsPageInner {...props} />
    </I18nProvider>
  );
}

function GenerateFlashcardsPageInner({ setId, setName }: Props) {
  const { t } = useTranslation("generate");

  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<FlashcardProposal[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkWord, setCheckWord] = useState("");
  const [removedInfo, setRemovedInfo] = useState<{ count: number; fronts: string[] } | null>(null);
  const proposalsRef = useRef<HTMLDivElement>(null);

  // Restore a saved page snapshot when returning from /lookup_word. Runs
  // post-mount (never in a useState initializer) to avoid a hydration mismatch
  // under client:load — see lessons.md. consume* removes the key so a manual
  // refresh does not re-restore stale state.
  useEffect(() => {
    const snap = consumeGenerateSnapshot(setId);
    if (snap) {
      // Restore-on-mount is the intended pattern here (see lessons.md); the
      // synchronous setState in this effect is deliberate, not a perf smell.
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setText(snap.text);
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setProposals(snap.proposals);
    }
  }, [setId]);

  const friendlyErrorMessage = (error: string | undefined, kind: string | undefined): string => {
    if (kind && FRIENDLY_ERROR_KINDS.includes(kind)) {
      return t(`generate.error.${kind}`);
    }
    return error ?? t("generate.somethingWrong");
  };

  useEffect(() => {
    if (proposals.length > 0 && proposalsRef.current) {
      proposalsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [proposals.length]);

  const inputTooShort = text.trim().length < MIN_INPUT_LENGTH;
  const inputTooLong = text.length > MAX_INPUT_LENGTH;
  const canGenerate = !inputTooShort && !inputTooLong && !isGenerating;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setErrorMessage(null);
    toast.info(t("generate.toastGenerating"));

    try {
      const response = await fetch(`/api/sets/${setId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, count: 5 }),
      });

      const result: GenerateResponse = await response.json();

      if (!response.ok) {
        const message = friendlyErrorMessage(result.error, result.kind);
        throw new Error(message);
      }

      const cards = result.flashcards;
      const removedCount = result.removedCount ?? 0;
      const removedFronts = result.removedFronts ?? [];

      if (removedCount > 0) {
        setRemovedInfo({ count: removedCount, fronts: removedFronts });
      } else {
        setRemovedInfo(null);
      }

      if (cards.length === 0) {
        setErrorMessage(t("generate.noProposalsInline"));
        return;
      }

      setProposals(cards);
      toast.success(t("generate.toastProposalsReady", { n: cards.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("generate.genericGenerateFail");
      setErrorMessage(message);
      toast.error(t("generate.toastGenerateFailed", { message }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProposalChange = (index: number, updated: FlashcardProposal) => {
    setProposals((prev) => prev.map((p, i) => (i === index ? updated : p)));
  };

  const handleProposalDelete = (index: number) => {
    setProposals((prev) => prev.filter((_, i) => i !== index));
  };

  const validProposals = proposals.filter((p) => {
    const parsed = flashcardContentSchema.safeParse(p);
    return parsed.success;
  });

  const handleSave = async () => {
    if (validProposals.length === 0) {
      toast.error(t("generate.noValidToSave"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/sets/${setId}/flashcards/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcards: validProposals }),
      });

      const result: SaveResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? t("generate.saveFailedStatus", { status: response.status }));
      }

      const count = result.count;
      const dbSkippedCount = result.skippedCount ?? 0;
      const dbSkippedFronts = result.skippedFronts ?? [];
      if (dbSkippedCount > 0) {
        toast.warning(t("generate.toastSavedSkipped", { count: dbSkippedCount, fronts: dbSkippedFronts.join(", ") }));
      }
      toast.success(t("generate.toastSaved", { count, name: setName }));
      window.location.href = `/sets/${setId}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("generate.genericSaveFail");
      setErrorMessage(message);
      toast.error(t("generate.toastSaveFailed", { message }));
    } finally {
      setIsSaving(false);
    }
  };

  const trimmedCheckWord = checkWord.trim();

  const handleCheckConfirm = () => {
    if (trimmedCheckWord === "") return;
    // Preserve the current page state, then hand the word off to /lookup_word.
    // The word travels via sessionStorage (not the URL), so it never lingers
    // as a query param. Navigation is a full reload (same tab).
    saveGenerateSnapshot(setId, { text, proposals });
    saveLookupPrefill(trimmedCheckWord);
    setCheckOpen(false);
    window.location.href = `/lookup_word?setId=${setId}`;
  };

  return (
    <div className="bg-cosmic min-h-screen p-4 text-white">
      <div className="mx-auto max-w-3xl">
        <a
          href={`/sets/${setId}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-blue-100/50 transition-colors hover:text-blue-100/80"
        >
          <BackIcon />
          {t("generate.backToSet", { name: setName })}
        </a>

        <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          {t("generate.heading")}
        </h1>
        <p className="mt-2 text-sm text-blue-100/50">{t("generate.intro", { name: setName })}</p>

        <Card className="mt-6 border-white/10 bg-white/5">
          <CardContent className="space-y-4">
            <label htmlFor="source-text" className="block text-sm font-medium text-blue-100/80">
              {t("generate.sourceLabel")}
            </label>
            <Textarea
              id="source-text"
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text");
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const updated = `${text.slice(0, start)}${pasted}${text.slice(end)}`;
                setText(updated);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={t("generate.sourcePlaceholder")}
              rows={8}
              disabled={isGenerating}
              className="bg-white/5 text-white placeholder:text-blue-100/30"
              maxLength={MAX_INPUT_LENGTH}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn("text-xs", inputTooLong ? "text-red-400" : "text-blue-100/40")}>
                {t("generate.charCount", { len: text.length, max: MAX_INPUT_LENGTH })}
                {inputTooShort && text.length > 0 && ` · ${t("generate.tooShort", { min: MIN_INPUT_LENGTH })}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCheckOpen(true);
                  }}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                >
                  {t("generate.check.button")}
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Spinner />
                      {t("generate.generating")}
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      {t("generate.generateButton")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            {errorMessage}
            {proposals.length === 0 && (
              <button type="button" onClick={handleGenerate} className="ml-2 underline hover:text-white">
                {t("generate.retry")}
              </button>
            )}
          </div>
        )}

        {isGenerating && proposals.length === 0 && (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-white/10" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                    <div className="h-20 animate-pulse rounded bg-white/10" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                    <div className="h-20 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {removedInfo && !isGenerating && (
          <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            {t("generate.removedBanner", {
              count: removedInfo.count,
              fronts: removedInfo.fronts.join(", "),
            })}
          </div>
        )}

        {proposals.length > 0 && !isGenerating && (
          <div ref={proposalsRef} className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {t("generate.proposalsHeading", { count: proposals.length })}
              </h2>
              <p className="text-xs text-blue-100/40">
                {t("generate.proposalsSummary", {
                  ready: validProposals.length,
                  invalid: proposals.length - validProposals.length,
                })}
              </p>
            </div>

            <div className="space-y-4">
              {proposals.map((proposal, index) => (
                <FlashcardProposalCard
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- proposals have no stable id; index is stable enough for this controlled list
                  key={`proposal-${index}`}
                  index={index}
                  proposal={proposal}
                  onChange={handleProposalChange}
                  onDelete={handleProposalDelete}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProposals([]);
                  setRemovedInfo(null);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
              >
                {t("generate.discardAll")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || validProposals.length === 0}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Spinner />
                    {t("generate.saving")}
                  </>
                ) : (
                  <>{t("generate.saveButton", { count: validProposals.length })}</>
                )}
              </Button>
            </div>
          </div>
        )}

        <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("generate.check.title")}</DialogTitle>
              <DialogDescription>{t("generate.check.description")}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckConfirm();
              }}
            >
              <Input
                autoFocus
                value={checkWord}
                onChange={(e) => {
                  setCheckWord(e.target.value);
                }}
                placeholder={t("generate.check.placeholder")}
                maxLength={MAX_CHECK_LENGTH}
              />
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCheckOpen(false);
                  }}
                >
                  {t("generate.check.cancel")}
                </Button>
                <Button type="submit" disabled={trimmedCheckWord === ""}>
                  {t("generate.check.confirm")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

function SparklesIcon() {
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
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function Spinner() {
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
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
