import { Card, CardContent } from "@/components/ui/card";
import type { DictionaryEntry } from "@/types";

/**
 * Renders a single dictionary entry: headword, part of speech, optional
 * region badge (hidden when `dictionaryRegion` is null — e.g. Pons DE→PL
 * never sets it), subject/register info, the definition, and up to N example
 * sentence pairs. Shared by the Cambridge and Pons lookup islands.
 */
export function EntryCard({ word, entry }: { word: string; entry: DictionaryEntry }) {
  return (
    <Card className="border-white/10 bg-white/10 pt-4 backdrop-blur-xl">
      <CardContent className="space-y-2">
        <h2 className="text-lg font-semibold text-white">{word}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {entry.type && <span className="text-sm font-medium text-purple-200 italic">{entry.type}</span>}
          {entry.dictionaryRegion && (
            <span className="rounded border border-white/20 px-1.5 py-0.5 text-xs font-medium text-blue-100/70">
              {entry.dictionaryRegion}
            </span>
          )}
          {entry.info && <span className="text-xs text-blue-100/50">{entry.info}</span>}
        </div>
        <p className="text-sm text-white">{entry.definition}</p>
        {entry.examples.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-blue-100/60">
            {entry.examples.map((example) => (
              <li key={example}>
                <ExampleText example={example} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Separator inserted by the Pons service between a German example phrase and
// its Polish translation (`dictionary-de.ts` EXAMPLE_SEPARATOR). Cambridge
// examples are plain sentences without it and render unchanged.
const EXAMPLE_SEPARATOR = " — ";

// Renders one example. For Pons DE→PL pairs ("<German> — <Polish>") the German
// original is emphasized and the Polish translation muted; plain examples
// (e.g. Cambridge) render as a single line.
function ExampleText({ example }: { example: string }) {
  const sep = example.indexOf(EXAMPLE_SEPARATOR);
  if (sep === -1) return <>{example}</>;
  const source = example.slice(0, sep);
  const translation = example.slice(sep + EXAMPLE_SEPARATOR.length);
  return (
    <>
      <span className="text-blue-100/80">{source}</span>
      <span className="text-blue-100/40">
        {EXAMPLE_SEPARATOR}
        {translation}
      </span>
    </>
  );
}
