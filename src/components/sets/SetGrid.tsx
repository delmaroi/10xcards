import { useTranslation } from "react-i18next";
import type { FlashcardSet } from "@/types";
import { SetCard } from "@/components/sets/SetCard";

type SetWithCount = FlashcardSet & { flashcard_count: number };

interface Props {
  sets: SetWithCount[];
  onRename: (set: SetWithCount) => void;
  onDelete: (set: SetWithCount) => void;
}

export function SetGrid({ sets, onRename, onDelete }: Props) {
  const { t } = useTranslation("dashboard");

  if (sets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-100/30"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </div>
        <p className="text-lg font-medium text-blue-100/60">{t("set.noSets")}</p>
        <p className="mt-1 text-sm text-blue-100/40">{t("set.noSetsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sets.map((set) => (
        <SetCard
          key={set.id}
          set={set}
          onRename={() => {
            onRename(set);
          }}
          onDelete={() => {
            onDelete(set);
          }}
        />
      ))}
    </div>
  );
}
