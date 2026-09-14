import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FlashcardProposal } from "@/lib/services/ai";
import { flashcardContentSchema } from "@/lib/services/flashcards";

interface Props {
  proposal: FlashcardProposal;
  index: number;
  onChange: (index: number, updated: FlashcardProposal) => void;
  onDelete: (index: number) => void;
}

const MAX_SIDE_LENGTH = flashcardContentSchema.shape.front.maxLength ?? 1000;

export default function FlashcardProposalCard({ proposal, index, onChange, onDelete }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFrontChange = (value: string) => {
    onChange(index, { ...proposal, front: value });
  };

  const handleBackChange = (value: string) => {
    onChange(index, { ...proposal, back: value });
  };

  const frontTooLong = proposal.front.length > MAX_SIDE_LENGTH;
  const backTooLong = proposal.back.length > MAX_SIDE_LENGTH;
  const frontEmpty = proposal.front.trim().length === 0;
  const backEmpty = proposal.back.trim().length === 0;
  const isInvalid = frontTooLong || backTooLong || frontEmpty || backEmpty;

  const handleDelete = () => {
    onDelete(index);
    toast.success("Proposal removed");
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/5 p-4 shadow-sm backdrop-blur-sm transition-colors",
        isInvalid && "border-red-400/50",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-blue-100/40">Proposal {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-8 text-red-400 hover:bg-red-400/10 hover:text-red-300"
        >
          <TrashIcon />
          Delete
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        <button
          type="button"
          onClick={() => {
            setIsFlipped((prev) => !prev);
          }}
          className="w-full rounded-md border border-blue-100/20 bg-white/5 p-4 text-left text-sm text-white transition-colors hover:bg-white/10"
        >
          <span className="mb-1 block text-xs font-medium text-blue-100/50">{isFlipped ? "Back" : "Front"}</span>
          {isFlipped ? proposal.back : proposal.front}
        </button>
        <p className="text-center text-xs text-blue-100/40">Tap the card to flip</p>
        <div className={cn("hidden", isFlipped ? "block" : "hidden")}>
          <label className="mb-1 block text-xs font-medium text-blue-100/60">Front</label>
          <Textarea
            value={proposal.front}
            onChange={(e) => {
              handleFrontChange(e.target.value);
            }}
            rows={3}
            className="bg-white/5 text-white"
            maxLength={MAX_SIDE_LENGTH}
          />
          <p className={cn("mt-1 text-right text-xs", frontTooLong ? "text-red-400" : "text-blue-100/40")}>
            {proposal.front.length}/{MAX_SIDE_LENGTH}
          </p>
        </div>
        <div className={cn(isFlipped ? "hidden" : "block")}>
          <label className="mb-1 block text-xs font-medium text-blue-100/60">Back</label>
          <Textarea
            value={proposal.back}
            onChange={(e) => {
              handleBackChange(e.target.value);
            }}
            rows={3}
            className="bg-white/5 text-white"
            maxLength={MAX_SIDE_LENGTH}
          />
          <p className={cn("mt-1 text-right text-xs", backTooLong ? "text-red-400" : "text-blue-100/40")}>
            {proposal.back.length}/{MAX_SIDE_LENGTH}
          </p>
        </div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-blue-100/60">Front</label>
          <Textarea
            value={proposal.front}
            onChange={(e) => {
              handleFrontChange(e.target.value);
            }}
            rows={3}
            className="bg-white/5 text-white"
            maxLength={MAX_SIDE_LENGTH}
          />
          <p className={cn("mt-1 text-right text-xs", frontTooLong ? "text-red-400" : "text-blue-100/40")}>
            {proposal.front.length}/{MAX_SIDE_LENGTH}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-blue-100/60">Back</label>
          <Textarea
            value={proposal.back}
            onChange={(e) => {
              handleBackChange(e.target.value);
            }}
            rows={3}
            className="bg-white/5 text-white"
            maxLength={MAX_SIDE_LENGTH}
          />
          <p className={cn("mt-1 text-right text-xs", backTooLong ? "text-red-400" : "text-blue-100/40")}>
            {proposal.back.length}/{MAX_SIDE_LENGTH}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
