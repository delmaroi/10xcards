import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { flashcardContentSchema } from "@/lib/services/flashcards";

/**
 * Form that turns a dictionary definition into a flashcard in the given set.
 * Reads copy from the shared `lookup` i18n namespace (`lookup.form.*`), so the
 * Cambridge and Pons islands reuse it verbatim. Stays on the page after a
 * successful save so the user can add another card.
 */
export function CreateCardForm({ setId }: { setId: string }) {
  const { t } = useTranslation("lookup");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const parsed = flashcardContentSchema.safeParse({ front, back });
    if (!parsed.success) {
      setError(t("lookup.form.invalid"));
      return;
    }

    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ set_id: setId, front: parsed.data.front, back: parsed.data.back }),
      });

      if (res.status === 201) {
        // Stay on the page so the user can add another card; clear the fields
        // but leave the search result visible.
        setFront("");
        setBack("");
        setError(null);
        toast.success(t("lookup.form.saved"));
      } else {
        // Surface the server's specific error when present (e.g. 404 "Set
        // not found"), falling back to the generic localized message.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const msg = body?.error ?? t("lookup.form.error");
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = t("lookup.form.error");
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  return (
    <Card className="border-white/10 bg-white/10 py-4 backdrop-blur-xl">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-base font-semibold text-blue-100/80">{t("lookup.form.heading")}</h2>
          <div className="space-y-2">
            <label htmlFor="lookup-front" className="text-sm font-medium text-white">
              {t("lookup.form.question")}
            </label>
            <Textarea
              id="lookup-front"
              value={front}
              onChange={(e) => {
                setFront(e.target.value);
                if (error) setError(null);
              }}
              disabled={pending}
              className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="lookup-back" className="text-sm font-medium text-white">
              {t("lookup.form.answer")}
            </label>
            <Textarea
              id="lookup-back"
              value={back}
              onChange={(e) => {
                setBack(e.target.value);
                if (error) setError(null);
              }}
              disabled={pending}
              className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-500">
            {pending ? t("lookup.form.saving") : t("lookup.form.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
