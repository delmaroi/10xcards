import { useState } from "react";
import { toast } from "sonner";
import type { FlashcardSet } from "@/types";
import { setNameSchema } from "@/lib/services/sets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (set: FlashcardSet) => void;
}

export function CreateSetDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setName("");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const parsed = setNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data }),
      });

      if (res.status === 201) {
        const data: FlashcardSet = await res.json();
        onCreate(data);
        setName("");
        setError(null);
      } else {
        const body: { error?: string } = await res.json();
        const msg = body.error ?? "Failed to create set";
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
          <DialogTitle>Create new set</DialogTitle>
          <DialogDescription className="text-blue-100/50">Give your set a name to get started.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Input
              id="name"
              placeholder="e.g. Spanish vocabulary"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              disabled={pending}
              className="border-white/10 bg-white/5 text-white placeholder:text-blue-100/30"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending} className="bg-purple-600 hover:bg-purple-500">
              {pending ? "Creating..." : "Create set"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
