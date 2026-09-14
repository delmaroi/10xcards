/* eslint-disable @eslint-react/no-array-index-key -- Pons senses can repeat a definition (e.g. "dom" for several senses of "Haus"); the React key is composite (index + type + region + definition) and the index prefix is an intentional disambiguator, not a bare-index key. */
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { I18nProvider } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DictionaryLookupError, lookupWordDeClient, type DictionaryLookupResult } from "@/lib/dict-de-client";
import { CreateCardForm } from "@/components/lookup/CreateCardForm";
import { EntryCard } from "@/components/lookup/EntryCard";
import type { SupportedLocale } from "@/lib/i18n/constants";

interface Props {
  setId: string;
  setName: string;
  locale: SupportedLocale;
}

export function LookupWordPageDe(props: Props) {
  return (
    <I18nProvider locale={props.locale}>
      <LookupWordPageDeInner {...props} />
    </I18nProvider>
  );
}

function LookupWordPageDeInner({ setId, setName }: Props) {
  const { t } = useTranslation("lookup");

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The create form unlocks once a search has *completed* — a successful
  // fetch, including an empty-result one. A network/HTTP error keeps it hidden.
  const [searchCompleted, setSearchCompleted] = useState(false);
  // Monotonic id so an out-of-order (superseded) response can't overwrite the
  // latest search's state. The loading guard already prevents UI-triggered
  // overlap; this is the correctness backstop.
  const searchSeqRef = useRef(0);

  function messageForStatus(status: number): string {
    switch (status) {
      case 429:
        return t("lookup.error.rateLimit");
      case 502:
        return t("lookup.error.unavailable");
      default:
        return t("lookup.error.generic");
    }
  }

  async function runSearch(wordArg?: string) {
    const word = (wordArg ?? query).trim();
    if (!word || loading) return;

    const seq = ++searchSeqRef.current;
    setLoading(true);
    setError(null);
    // Reset the previous result up front so a new search never visually
    // accumulates with the old one (and stale results don't linger while
    // the request is in flight).
    setResult(null);

    try {
      const data = await lookupWordDeClient(word);
      if (seq !== searchSeqRef.current) return; // superseded by a newer search
      setResult(data);
      setSearchCompleted(true);
    } catch (err) {
      if (seq !== searchSeqRef.current) return; // superseded by a newer search
      const status = err instanceof DictionaryLookupError ? err.status : 0;
      const msg = messageForStatus(status);
      setError(msg);
      setResult(null);
      setSearchCompleted(false);
      toast.error(msg);
    } finally {
      if (seq === searchSeqRef.current) setLoading(false);
    }
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void runSearch();
  }

  return (
    <div className="bg-cosmic flex min-h-screen items-start justify-center p-4 pt-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <a
            href={`/sets/${setId}`}
            className="inline-flex items-center gap-1 text-sm text-blue-100/50 transition-colors hover:text-blue-100/80"
          >
            <BackIcon />
            {t("lookup.backToSet")}
          </a>
        </div>

        <div className="space-y-1">
          <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
            {t("lookup_de.heading")}
          </h1>
          <p className="text-sm text-blue-100/60">{t("lookup.addingTo", { name: setName })}</p>
        </div>

        <Card className="border-white/10 bg-white/10 py-4 backdrop-blur-xl">
          <CardContent>
            <p className="text-sm text-blue-100/70">{t("lookup_de.intro")}</p>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder={t("lookup_de.searchPlaceholder")}
            disabled={loading}
            className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
          />
          <Button
            type="submit"
            disabled={loading || query.trim() === ""}
            className="shrink-0 bg-purple-600 hover:bg-purple-500"
          >
            {loading ? t("lookup.searching") : t("lookup.searchButton")}
          </Button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-blue-100/80">{t("lookup_de.responseHeading")}</h2>
            <SearchResults result={result} emptyLabel={t("lookup_de.noResults", { word: result.word })} />
          </section>
        )}

        {searchCompleted && <CreateCardForm setId={setId} />}
      </div>
    </div>
  );
}

// At most this many result cards are visible at once; the rest scroll.
const MAX_VISIBLE_CARDS = 2;
// Matches the `space-y-3` gap between cards (0.75rem).
const CARD_GAP_PX = 12;

function SearchResults({ result, emptyLabel }: { result: DictionaryLookupResult; emptyLabel: string }) {
  if (result.entries.length === 0) {
    return (
      <Card className="border-white/10 bg-white/10 backdrop-blur-xl">
        <CardContent>
          <p className="text-sm text-blue-100/60">{emptyLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return <ResultsList result={result} />;
}

function ResultsList({ result }: { result: DictionaryLookupResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cards vary in height (examples count), so derive the container cap from
  // the actual rendered height of the first MAX_VISIBLE_CARDS cards plus the
  // gaps between them. Anything beyond that scrolls. Applied imperatively to
  // avoid an extra render from setState-in-effect.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const list = listRef.current;
    if (!container || !list) return;
    const cards = Array.from(list.children) as HTMLElement[];
    if (cards.length <= MAX_VISIBLE_CARDS) {
      container.style.maxHeight = "";
      return;
    }
    const total =
      cards.slice(0, MAX_VISIBLE_CARDS).reduce((sum, el) => sum + el.offsetHeight, 0) +
      CARD_GAP_PX * (MAX_VISIBLE_CARDS - 1);
    container.style.maxHeight = `${total}px`;
  }, [result]);

  return (
    <div ref={containerRef} className="overflow-y-auto pr-1">
      <div ref={listRef} className="space-y-3">
        {result.entries.map((entry, index) => (
          // Senses can repeat a definition (e.g. Pons returns "dom" for several
          // senses of "Haus"), so the index disambiguates otherwise-equal keys.
          // The full key is composite (index + type + region + definition); the
          // index prefix is intentional, not a bare-index key.
          <EntryCard
            key={`${index}-${entry.type ?? ""}-${entry.dictionaryRegion ?? ""}-${entry.definition}`}
            word={result.word}
            entry={entry}
          />
        ))}
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
