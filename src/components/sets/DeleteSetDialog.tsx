import { useState } from "react";
import { toast } from "sonner";
import type { FlashcardSet } from "@/types";
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
  set: FlashcardSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (setId: string) => void;
}

export function DeleteSetDialog({ set, open, onOpenChange, onDelete }: Props) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!set) return;

    setPending(true);

    try {
      const res = await fetch(`/api/sets/${set.id}`, {
        method: "DELETE",
      });

      if (res.status === 200) {
        onDelete(set.id);
      } else {
        const body: { error?: string } = await res.json();
        toast.error(body.error ?? "Failed to delete set");
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
          <DialogTitle>Delete set?</DialogTitle>
          <DialogDescription className="text-blue-100/50">
            This will permanently delete &ldquo;{set?.name}&rdquo; and all its flashcards. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
