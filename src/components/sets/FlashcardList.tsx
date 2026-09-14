import type { Flashcard } from "@/types";
import { FlashcardCard } from "@/components/sets/FlashcardCard";

interface Props {
  flashcards: Flashcard[];
  onEdit: (flashcard: Flashcard) => void;
  onDelete: (flashcard: Flashcard) => void;
}

export function FlashcardList({ flashcards, onEdit, onDelete }: Props) {
  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-blue-100/60">No flashcards yet.</p>
        <p className="mt-1 text-sm text-blue-100/40">Create your first flashcard to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flashcards.map((flashcard) => (
        <FlashcardCard
          key={flashcard.id}
          flashcard={flashcard}
          onEdit={() => {
            onEdit(flashcard);
          }}
          onDelete={() => {
            onDelete(flashcard);
          }}
        />
      ))}
    </div>
  );
}
