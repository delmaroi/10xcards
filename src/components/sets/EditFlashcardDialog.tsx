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
  flashcard: Flashcard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (flashcard: Flashcard) => void;
}

export function EditFlashcardDialog({ flashcard, open, onOpenChange, onUpdate }: Props) {
  const [front, setFront] = useState(flashcard?.front ?? "");
  const [back, setBack] = useState(flashcard?.back ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flashcard) return;

    const parsed = flashcardContentSchema.safeParse({ front, back });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/flashcards/${flashcard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: parsed.data.front,
          back: parsed.data.back,
        }),
      });

      if (res.status === 200) {
        const data: Flashcard = await res.json();
        onUpdate(data);
        setError(null);
      } else {
        const body: { error?: string } = await res.json();
        const msg = body.error ?? "Failed to update flashcard";
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
          <DialogTitle>Edit flashcard</DialogTitle>
          <DialogDescription className="text-blue-100/50">Update the question and answer below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="edit-front" className="text-sm font-medium text-white">
                Front
              </label>
              <Textarea
                id="edit-front"
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
              <label htmlFor="edit-back" className="text-sm font-medium text-white">
                Back
              </label>
              <Textarea
                id="edit-back"
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
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
