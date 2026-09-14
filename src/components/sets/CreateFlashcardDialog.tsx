import { useState } from "react";
import { toast } from "sonner";
import type { Flashcard } from "@/types";
import { flashcardContentSchema } from "@/lib/services/flashcards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  onCreate: (flashcard: Flashcard) => void;
}

export function CreateFlashcardDialog({ open, onOpenChange, setId, onCreate }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setFront("");
      setBack("");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = flashcardContentSchema.safeParse({ front, back });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          set_id: setId,
          front: parsed.data.front,
          back: parsed.data.back,
        }),
      });

      if (res.status === 201) {
        const data: Flashcard = await res.json();
        onCreate(data);
        setFront("");
        setBack("");
        setError(null);
      } else {
        const body: { error?: string } = await res.json();
        const msg = body.error ?? "Failed to create flashcard";
        setError(msg);
        toast.error(msg);
      }
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-white/10 bg-[#0f1529] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new flashcard</DialogTitle>
          <DialogDescription className="text-blue-100/50">Add a question and answer to this set.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="front" className="text-sm font-medium text-white">
                Front
              </label>
              <Textarea
                id="front"
                placeholder="Question or prompt"
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
              <label htmlFor="back" className="text-sm font-medium text-white">
                Back
              </label>
              <Textarea
                id="back"
                placeholder="Answer"
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
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-500">
              {pending ? "Creating..." : "Create flashcard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
