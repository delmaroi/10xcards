import { useState } from "react";
import { toast } from "sonner";
import type { Flashcard } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface Props {
  flashcard: Flashcard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (flashcardId: string) => void;
}

export function DeleteFlashcardDialog({ flashcard, open, onOpenChange, onDelete }: Props) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!flashcard) return;

    setPending(true);

    try {
      const res = await fetch(`/api/flashcards/${flashcard.id}`, {
        method: "DELETE",
      });

      if (res.status === 200) {
        onDelete(flashcard.id);
      } else {
        const body: { error?: string } = await res.json();
        toast.error(body.error ?? "Failed to delete flashcard");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0f1529] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete flashcard?</DialogTitle>
          <DialogDescription className="text-blue-100/50">
            This will permanently delete this flashcard. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete flashcard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
