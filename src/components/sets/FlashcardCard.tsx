import { CheckCircle2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { State } from "@/types";
import type { Flashcard } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  flashcard: Flashcard;
  onEdit: () => void;
  onDelete: () => void;
}

export function FlashcardCard({ flashcard, onEdit, onDelete }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-100/50">Front</p>
          <p className="mt-1 whitespace-pre-wrap text-white">{flashcard.front}</p>
          <div className="my-3 h-px bg-white/10" />
          <p className="text-sm font-medium text-blue-100/50">Back</p>
          <p className="mt-1 whitespace-pre-wrap text-white">{flashcard.back}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {flashcard.state === State.Review && <CheckCircle2 className="h-4 w-4 text-green-400" aria-label="Learned" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-blue-100/50 hover:text-white"
                aria-label="Flashcard actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
